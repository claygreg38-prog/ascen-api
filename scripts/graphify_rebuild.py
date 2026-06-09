#!/usr/bin/env python3
"""
Rebuild the ascen-api CODE-ONLY Graphify knowledge graph (local, no LLM, no network).

Invoked by scripts/graphify-rebuild.ps1, which selects the uv-managed interpreter that
has graphifyy installed. Writes to graphify-out/:
    graph.json, GRAPH_REPORT.md, graph.html, .graph-meta

Data residency: AST (tree-sitter) only. No API key is read, and the base graphifyy
install has no LLM client libraries, so semantic extraction cannot run. Docs / PDFs /
images are detected but NOT ingested — code files only.

The .graph-meta currency stamp (commit SHA + UTC time) is written on every build and
also prepended to GRAPH_REPORT.md so staleness is detectable by the ascen-map subagent.
"""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "graphify-out"

from graphify.detect import detect
from graphify.extract import extract
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections
from graphify.report import generate
from graphify.export import to_json, to_html


def git_head(root: Path) -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=str(root),
            capture_output=True, text=True, check=True,
        )
        return out.stdout.strip()
    except Exception:
        return "unknown"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)

    print("[1/6] detect (local fs scan)...", flush=True)
    detection = detect(ROOT)
    files = detection["files"]
    counts = {k: len(v) for k, v in files.items()}
    code_files = [Path(f) for f in files.get("code", [])]
    print(
        f"   code={len(code_files)}  (NOT ingested: docs={counts.get('document', 0)} "
        f"papers={counts.get('paper', 0)} images={counts.get('image', 0)} "
        f"video={counts.get('video', 0)})",
        flush=True,
    )
    if not code_files:
        print("ERROR: no code files detected", flush=True)
        return 2

    print("[2/6] AST extract (tree-sitter, single-process, no LLM)...", flush=True)
    extraction = extract(code_files, cache_root=ROOT, parallel=False)
    extraction.setdefault("input_tokens", 0)
    extraction.setdefault("output_tokens", 0)

    print("[3/6] build graph...", flush=True)
    G = build_from_json(extraction)
    if G.number_of_nodes() == 0:
        print("ERROR: empty graph", flush=True)
        return 3

    print("[4/6] cluster + cohesion...", flush=True)
    communities = cluster(G)
    cohesion = score_all(G, communities)

    print("[5/6] analyze...", flush=True)
    gods = god_nodes(G, top_n=20)
    surprises = surprising_connections(G, communities)
    labels = {cid: f"Community {cid}" for cid in communities}
    tokens = {"input": 0, "output": 0}

    print("[6/6] write report + json + html + currency stamp...", flush=True)
    report = generate(
        G, communities, cohesion, labels, gods, surprises, detection, tokens, str(ROOT)
    )

    sha = git_head(ROOT)
    built_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    meta = {
        "build_sha": sha,
        "built_at_utc": built_at,
        "mode": "code-only",
        "resolved_imports": False,
        "nodes": G.number_of_nodes(),
        "edges": G.number_of_edges(),
        "communities": len(communities),
        "code_files": len(code_files),
    }
    (OUT / ".graph-meta").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")

    stamp = (
        "<!-- graphify currency stamp (written every build) -->\n"
        f"> **Graph build:** `{sha}` · {built_at} · mode: **code-only (imports NOT resolved)** · "
        f"{meta['nodes']} nodes / {meta['edges']} edges / {meta['communities']} communities\n"
        f"> Stale if `build_sha` != current `git rev-parse HEAD`. "
        f"Rebuild: `powershell -ExecutionPolicy Bypass -File scripts/graphify-rebuild.ps1`\n\n"
    )
    (OUT / "GRAPH_REPORT.md").write_text(stamp + report, encoding="utf-8")
    to_json(G, communities, str(OUT / "graph.json"))
    try:
        to_html(
            G, communities, str(OUT / "graph.html"),
            community_labels=labels,
            member_counts={cid: len(m) for cid, m in communities.items()},
        )
    except Exception as exc:  # noqa: BLE001 - HTML is optional, never fail the build on it
        print(f"   HTML generation skipped: {exc!r}", flush=True)

    print("DONE. graphify-out/.graph-meta:")
    print((OUT / ".graph-meta").read_text(encoding="utf-8"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
