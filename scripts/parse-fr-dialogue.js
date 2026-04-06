#!/usr/bin/env node
/**
 * Parse FR session YAML files and generate dialogue_phases SQL.
 * Outputs SQL UPDATE statements with track='fr_apprentice' filter.
 */

const fs = require('fs');
const path = require('path');

const INPUT_DIR = process.argv[2] || path.join(__dirname, '../../temp-extract/fr-corrected');

function escapeSQL(str) {
  return str.replace(/'/g, "''");
}

function extractDialogue(content, sectionName) {
  // Find section block ending at next comment header (# ═) or EOF
  const sectionRegex = new RegExp(
    '^' + sectionName + ':\\\\s*\\n([\\\\s\\\\S]*?)(?=\\n# |$)', 'mi'
  );
  // The template literal double-escapes, so build manually:
  const idx = content.search(new RegExp('^' + sectionName + ':', 'mi'));
  if (idx < 0) return [];

  // Find next section boundary (# ═ comment block)
  const afterSection = content.substring(idx);
  const endMatch = afterSection.match(/\n# [═=]/);
  const block = endMatch ? afterSection.substring(0, endMatch.index) : afterSection;

  const lines = [];
  const lineRegex = /- speaker:\s*"(\w+)"\s*\n\s+text:\s*"(.*?)"/gm;
  let m;
  while ((m = lineRegex.exec(block)) !== null) {
    lines.push({ speaker: m[1], text: m[2] });
  }
  return lines;
}

function extractBreathingCues(content) {
  // Find cue_set entries with text fields
  const cues = [];
  const cueRegex = /cue_id:\s*"[^"]+"\s*\n\s+relative_time_pct:[^\n]+\n\s+speaker:\s*"[^"]+"\s*\n\s+text:\s*"(.*?)"/gm;
  let m;
  while ((m = cueRegex.exec(content)) !== null) {
    const text = m[1].trim();
    if (text) cues.push(text); // Skip empty cues (pauses)
  }
  return cues;
}

function extractVaultPrompt(content) {
  const match = content.match(/vault_prompt:\s*"(.*?)"/m) ||
                content.match(/private_prompt:\s*"(.*?)"/m);
  return match ? match[1].trim() : null;
}

// Process all FR YAML files
const files = fs.readdirSync(INPUT_DIR)
  .filter(f => f.match(/^fr_session_\d+/))
  .sort();

const sqlLines = [
  '-- Migration 075: Fix FR contamination + seed FR from corrected source',
  '-- Step 1: Clear contaminated foundation dialogue from FR rows',
  "UPDATE session_templates SET dialogue_phases = NULL WHERE track = 'fr_apprentice';",
  '',
  '-- Step 2: Seed FR-specific dialogue from fr_sessions_rewritten_corrected.zip',
  ''
];

let count = 0;

for (const file of files) {
  const numMatch = file.match(/fr_session_(\d+)/);
  if (!numMatch) continue;
  const sessionNum = parseInt(numMatch[1]);

  const content = fs.readFileSync(path.join(INPUT_DIR, file), 'utf8');

  const phases = {};

  const arrival = extractDialogue(content, 'arrival');
  if (arrival.length > 0) phases.arrival = { lines: arrival };

  const opening = extractDialogue(content, 'opening');
  if (opening.length > 0) phases.opening = { lines: opening };

  const resistance = extractDialogue(content, 'resistance');
  if (resistance.length > 0) phases.resistance = { lines: resistance };

  const btb = extractDialogue(content, 'before_the_breath');
  if (btb.length > 0) phases.before_the_breath = { lines: btb };

  const cues = extractBreathingCues(content);
  if (cues.length > 0) phases.breathing = { round_cues: cues };

  const shift = extractDialogue(content, 'shift_moment');
  if (shift.length > 0) phases.shift_moment = { lines: shift };

  const close = extractDialogue(content, 'close');
  if (close.length > 0) phases.close = { lines: close };

  const vault = extractVaultPrompt(content);
  if (vault) phases.vault = { prompt: vault };

  if (Object.keys(phases).length === 0) {
    console.error(`WARN: No dialogue extracted for FR${String(sessionNum).padStart(2, '0')} (${file})`);
    continue;
  }

  const json = JSON.stringify(phases, null, 2);
  const escaped = escapeSQL(json);

  sqlLines.push(`-- ── FR${String(sessionNum).padStart(2, '0')}: ${file} ──`);
  sqlLines.push(`UPDATE session_templates SET dialogue_phases = '${escaped}'::jsonb WHERE session_number = ${sessionNum} AND track = 'fr_apprentice';`);
  sqlLines.push('');
  count++;

  const phaseCount = Object.keys(phases).length;
  console.error(`FR${String(sessionNum).padStart(2, '0')}: ${phaseCount} phases`);
}

console.log(sqlLines.join('\n'));
console.error(`\nGenerated SQL for ${count} FR sessions`);
