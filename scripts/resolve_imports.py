#!/usr/bin/env python3
"""
Build a RESOLVED-IMPORT dependency graph for ascen-api (local, deterministic, no LLM,
no network). Unlike the code-only AST graph (whose import edges are name-matched and
include cross-language false positives), this resolves every relative require()/import
specifier to an actual file on disk using Node resolution rules, so cross-module
ROUTING can be verified.

Handles CommonJS (require) for the backend and ESM (import/export ... from) for the
frontend. Only literal string specifiers are resolved; dynamic/computed requires are
reported as unresolved, never guessed.

Outputs to graphify-out/:
    import-graph.json   nodes (files) + directed edges (A imports B) + external deps
    IMPORT_REPORT.md    routing analysis (ABI/AXIS reachability, hubs, bypass candidates)
    .import-graph-meta  currency stamp (commit SHA + UTC)
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "graphify-out"

PARSE_EXTS = {".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"}
RESOLVE_EXTS = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".json"]

# Specifier extractors. Literal string args only.
RE_REQUIRE = re.compile(r"""require\(\s*['"]([^'"]+)['"]\s*\)""")
RE_IMPORT_FROM = re.compile(r"""import[^'";]*?from\s*['"]([^'"]+)['"]""")
RE_EXPORT_FROM = re.compile(r"""export[^'";]*?from\s*['"]([^'"]+)['"]""")
RE_SIDE_EFFECT = re.compile(r"""(?m)^\s*import\s+['"]([^'"]+)['"]""")
RE_DYNAMIC = re.compile(r"""import\(\s*['"]([^'"]+)['"]\s*\)""")


def git_head(root: Path) -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=str(root),
            capture_output=True, text=True, check=True,
        ).stdout.strip()
    except Exception:
        return "unknown"


def rel(p: Path) -> str:
    return p.resolve().relative_to(ROOT).as_posix()


def area_of(relpath: str) -> str:
    parts = relpath.split("/")
    if parts[0] in ("src", "frontend", "public", "scripts", "tests", "migrations"):
        return "/".join(parts[:2]) if len(parts) > 1 else parts[0]
    return "(root)"


def specifiers(text: str) -> list[str]:
    specs: list[str] = []
    for rx in (RE_REQUIRE, RE_IMPORT_FROM, RE_EXPORT_FROM, RE_SIDE_EFFECT, RE_DYNAMIC):
        specs.extend(rx.findall(text))
    return specs


def resolve(spec: str, from_file: Path) -> tuple[str, str]:
    """Return (kind, value). kind in {'internal','external','unresolved'}."""
    if spec.startswith("."):
        base = (from_file.parent / spec).resolve()
        candidates: list[Path] = [base]
        for ext in RESOLVE_EXTS:
            candidates.append(base.with_name(base.name + ext))
        for ext in RESOLVE_EXTS:
            candidates.append(base / ("index" + ext))
        for c in candidates:
            if c.is_file():
                try:
                    return "internal", rel(c)
                except ValueError:
                    return "unresolved", spec  # resolved outside repo
        return "unresolved", spec
    if spec.startswith("/"):
        return "unresolved", spec  # filesystem-absolute, skip
    # bare specifier -> external package (scoped pkg keeps first two segments)
    root_pkg = "/".join(spec.split("/")[:2]) if spec.startswith("@") else spec.split("/")[0]
    return "external", root_pkg


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)

    from graphify.detect import detect

    detection = detect(ROOT)
    code_files = [Path(f) for f in detection["files"].get("code", [])]
    parse_files = [p for p in code_files if p.suffix.lower() in PARSE_EXTS]
    print(f"[1/3] parsing {len(parse_files)} JS/TS files (of {len(code_files)} code files)...", flush=True)

    edges: set[tuple[str, str]] = set()
    external: dict[str, set[str]] = defaultdict(set)
    unresolved: list[tuple[str, str]] = []
    nodes: set[str] = set()

    for f in parse_files:
        src = rel(f)
        nodes.add(src)
        try:
            text = f.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for spec in specifiers(text):
            kind, val = resolve(spec, f)
            if kind == "internal":
                edges.add((src, val))
                nodes.add(val)
            elif kind == "external":
                external[src].add(val)
            else:
                unresolved.append((src, spec))

    # Directed adjacency: A imports B  (A -> B)
    out_adj: dict[str, set[str]] = defaultdict(set)
    in_adj: dict[str, set[str]] = defaultdict(set)
    for a, b in edges:
        out_adj[a].add(b)
        in_adj[b].add(a)

    # Core ABI/AXIS set, located by basename among resolved nodes.
    core_basenames = {
        "sessionOrchestrator.js": "ABI orchestrator",
        "integrationLayer.js": "ABI integration layer (AbiService)",
        "axisEngine.js": "AXIS engine",
        "ns3AxisBridge.js": "AXIS/NS3 bridge",
    }
    by_base: dict[str, list[str]] = defaultdict(list)
    for n in nodes:
        by_base[n.split("/")[-1]].append(n)
    core = {n for bn in core_basenames for n in by_base.get(bn, [])}

    # Ancestors of core: nodes X with a directed path X ->* core (i.e. X routes through core).
    reaches_core: set[str] = set()
    dq = deque(core)
    reaches_core |= core
    while dq:
        cur = dq.popleft()
        for pred in in_adj.get(cur, ()):
            if pred not in reaches_core:
                reaches_core.add(pred)
                dq.append(pred)

    # Weakly-connected components (undirected) — connectivity sanity vs token graph's 98.
    undirected: dict[str, set[str]] = defaultdict(set)
    for a, b in edges:
        undirected[a].add(b)
        undirected[b].add(a)
    seen: set[str] = set()
    comps: list[int] = []
    for n in nodes:
        if n in seen:
            continue
        size = 0
        stack = [n]
        seen.add(n)
        while stack:
            c = stack.pop()
            size += 1
            for nb in undirected.get(c, ()):
                if nb not in seen:
                    seen.add(nb)
                    stack.append(nb)
        comps.append(size)
    comps.sort(reverse=True)

    indeg = sorted(nodes, key=lambda n: len(in_adj.get(n, ())), reverse=True)
    outdeg = sorted(nodes, key=lambda n: len(out_adj.get(n, ())), reverse=True)

    # Routing checks
    route_files = sorted(
        n for n in nodes if "/routes/" in n or n.split("/")[-1].lower().endswith("routes.js")
    )
    routes_bypassing = [r for r in route_files if r not in reaches_core]

    # Blockchain rule: only verificationService.js may import 'ethers'.
    ethers_offenders = sorted(
        f for f, pkgs in external.items()
        if "ethers" in pkgs and f.split("/")[-1] != "verificationService.js"
    )

    sha = git_head(ROOT)
    built_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    graph_obj = {
        "meta": {
            "build_sha": sha, "built_at_utc": built_at, "mode": "resolved-imports",
            "resolved_imports": True,
            "files": len(nodes), "internal_edges": len(edges),
            "external_pkgs": sorted({p for ps in external.values() for p in ps}),
            "unresolved_count": len(unresolved),
            "components": len(comps),
        },
        "core": sorted(core),
        "nodes": [
            {"id": n, "area": area_of(n),
             "in_deg": len(in_adj.get(n, ())), "out_deg": len(out_adj.get(n, ())),
             "reaches_core": n in reaches_core}
            for n in sorted(nodes)
        ],
        "edges": [{"source": a, "target": b} for a, b in sorted(edges)],
        "external": {f: sorted(p) for f, p in sorted(external.items())},
        "unresolved": [{"file": f, "specifier": s} for f, s in unresolved],
    }
    (OUT / "import-graph.json").write_text(json.dumps(graph_obj, indent=2), encoding="utf-8")
    (OUT / ".import-graph-meta").write_text(
        json.dumps(graph_obj["meta"], indent=2) + "\n", encoding="utf-8"
    )

    L = []
    L.append("<!-- resolved-import currency stamp (written every build) -->")
    L.append(
        f"> **Resolved-import graph:** `{sha}` · {built_at} · "
        f"{len(nodes)} files / {len(edges)} internal edges / {len(comps)} components"
    )
    L.append(f"> Stale if `build_sha` != `git rev-parse HEAD`. Rebuild: `scripts/graphify-rebuild.ps1`\n")
    L.append("# ascen-api — Resolved-Import Routing Report\n")
    L.append("Method: filesystem-resolved relative require()/import specifiers (CommonJS + ESM). "
             "Literal specifiers only; dynamic/computed not resolved. External (npm/builtin) deps "
             "recorded per file but not graphed as nodes.\n")
    L.append(f"- Files (JS/TS reachable in import graph): **{len(nodes)}**")
    L.append(f"- Internal resolved edges (A imports B): **{len(edges)}**")
    L.append(f"- Weakly-connected components: **{len(comps)}** (largest {comps[0] if comps else 0}); "
             f"compare code-only token graph: 98")
    L.append(f"- Unresolved relative specifiers (dynamic/missing): **{len(unresolved)}**\n")

    L.append("## Core ABI/AXIS nodes located")
    for n in sorted(core):
        bn = n.split("/")[-1]
        L.append(f"- `{n}` — {core_basenames.get(bn,'')} "
                 f"(in_deg {len(in_adj.get(n,()))}, out_deg {len(out_adj.get(n,()))})")
    if not core:
        L.append("- (none found — basenames not present)")
    L.append("")

    L.append("## Top fan-in (most imported = real cross-module hubs)")
    for n in indeg[:15]:
        L.append(f"- `{n}` ← imported by {len(in_adj.get(n,()))}")
    L.append("")
    L.append("## Top fan-out (imports the most)")
    for n in outdeg[:15]:
        L.append(f"- `{n}` → imports {len(out_adj.get(n,()))}")
    L.append("")

    L.append("## Routing check — route files vs ABI/AXIS core")
    L.append(f"- Route files: **{len(route_files)}**; reaching ABI/AXIS via import chain: "
             f"**{len(route_files)-len(routes_bypassing)}**; NOT reaching: **{len(routes_bypassing)}**")
    if routes_bypassing:
        L.append("- Route files with NO import path to ABI/AXIS core (candidates — verify manually, "
                 "may route at runtime via req handlers not imports):")
        for r in routes_bypassing:
            L.append(f"  - `{r}`")
    L.append("")

    L.append("## Blockchain rule — direct `ethers` importers (should be verificationService.js ONLY)")
    if ethers_offenders:
        for f in ethers_offenders:
            L.append(f"- ⚠️ `{f}`")
    else:
        L.append("- ✅ none — only verificationService.js imports ethers")
    L.append("")

    L.append("## Caveat")
    L.append("Static import edges show DEPENDENCY wiring, not runtime request routing. A file that "
             "doesn't import ABI/AXIS may still be invoked through them at runtime (Express route "
             "handlers, event emitters, DI). Treat 'not reaching core' as a lead to verify, not proof "
             "of a bypass.")
    (OUT / "IMPORT_REPORT.md").write_text("\n".join(L) + "\n", encoding="utf-8")

    print(f"[2/3] resolved {len(edges)} internal edges across {len(nodes)} files; "
          f"{len(unresolved)} unresolved; {len(comps)} components", flush=True)
    print("[3/3] wrote import-graph.json, IMPORT_REPORT.md, .import-graph-meta", flush=True)
    print("\nCORE:", sorted(core))
    print("ROUTE FILES NOT REACHING CORE:", routes_bypassing)
    print("DIRECT ETHERS OFFENDERS:", ethers_offenders)
    return 0


if __name__ == "__main__":
    sys.exit(main())
