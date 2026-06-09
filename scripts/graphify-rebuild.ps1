#requires -Version 5.1
<#
  Rebuild the ascen-api CODE-ONLY Graphify code graph (local, no LLM, no network).

  CLI fact (the handoff doc was inconsistent): the installed CLI is `graphify`
  (single-y); the PyPI package is `graphifyy` (double-y). No `uv` prefix is needed to
  call the `graphify` CLI. This rebuild does NOT use the CLI -- it drives the graphifyy
  Python library directly through the uv-managed interpreter, because we need an
  explicit code-only (AST, no-LLM, no-doc-ingest) FULL rebuild plus a currency stamp,
  which the CLI does not do in one shot.

  Usage:  powershell -ExecutionPolicy Bypass -File scripts/graphify-rebuild.ps1
#>
$ErrorActionPreference = "Stop"

# Data residency: never expose an LLM key to the build process.
foreach ($k in "GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
                "DEEPSEEK_API_KEY", "MOONSHOT_API_KEY", "AZURE_OPENAI_API_KEY") {
    Remove-Item "Env:$k" -ErrorAction SilentlyContinue
}
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"

# Resolve the uv-managed interpreter that has graphifyy installed.
# 1) default uv tools dir (%APPDATA%\uv\tools), 2) `uv tool dir` if uv is on PATH.
$py = $null
$default = Join-Path $env:APPDATA "uv\tools\graphifyy\Scripts\python.exe"
if (Test-Path $default) {
    $py = $default
}
elseif (Get-Command uv -ErrorAction SilentlyContinue) {
    $uvDir = (uv tool dir 2>$null).Trim()
    if ($uvDir) {
        $cand = Join-Path $uvDir "graphifyy\Scripts\python.exe"
        if (Test-Path $cand) { $py = $cand }
    }
}
if (-not $py) {
    Write-Error "graphifyy interpreter not found. Install with: winget install astral-sh.uv ; uv tool install graphifyy"
    exit 1
}

& $py (Join-Path $PSScriptRoot "graphify_rebuild.py")
exit $LASTEXITCODE
