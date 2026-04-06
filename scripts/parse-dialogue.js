#!/usr/bin/env node
/**
 * Parse ASCEN session markdown files and generate dialogue_phases SQL.
 *
 * Usage: node scripts/parse-dialogue.js <input-dir> [session-range]
 * Example: node scripts/parse-dialogue.js ../temp-extract/full150 16-40
 *
 * Reads all markdown files, extracts dialogue per session per phase,
 * and outputs SQL UPDATE statements for session_templates.dialogue_phases.
 */

const fs = require('fs');
const path = require('path');

const INPUT_DIR = process.argv[2] || path.join(__dirname, '../../temp-extract/full150');
const RANGE = process.argv[3]; // e.g., "16-40"

let rangeMin = 0, rangeMax = 999;
if (RANGE) {
  const [a, b] = RANGE.split('-').map(Number);
  rangeMin = a; rangeMax = b;
}

// Priority order for files (highest priority first)
const FILE_PRIORITY = [
  'Full_Dialogue_Expansion',
  'Full_Expansion',
  'Somatic_Mastery',
  'Feeling_Map',
  'Enhanced_Narrative',
  'Patch'
];

function getFilePriority(filename) {
  for (let i = 0; i < FILE_PRIORITY.length; i++) {
    if (filename.includes(FILE_PRIORITY[i])) return i;
  }
  return FILE_PRIORITY.length;
}

// Parse a markdown file and extract sessions
function parseMarkdown(content, filename) {
  const sessions = {};

  // Split by session headers:
  // - ### SESSION N or ## SESSION N (canonical format)
  // - # S102 — Title (condensed format inside grouped blocks)
  const sessionBlocks = content.split(/(?=^#{1,3}\s+(?:SESSION\s+\d+|S\d+\s*[—–-]))/mi);

  for (const block of sessionBlocks) {
    // Extract session number from either format
    const headerMatch = block.match(/^#{1,3}\s+(?:SESSION\s+(\d+)|S(\d+)\s*[—–-])/mi);
    if (!headerMatch) continue;
    const sessionNum = parseInt(headerMatch[1] || headerMatch[2]);

    // Extract title
    const titleMatch = block.match(/(?:title:\s*"?([^"\n]+)"?|—\s*(.+)$)/mi);
    const title = (titleMatch && (titleMatch[1] || titleMatch[2] || '').trim()) || '';

    // Extract each phase's dialogue
    const phases = {};

    // Arrival
    const arrivalLines = extractPhaseDialogue(block, 'arrival');
    if (arrivalLines.length > 0) phases.arrival = { lines: arrivalLines };

    // Opening
    const openingLines = extractPhaseDialogue(block, 'opening');
    if (openingLines.length > 0) phases.opening = { lines: openingLines };

    // Resistance
    const resistanceLines = extractPhaseDialogue(block, 'resistance');
    if (resistanceLines.length > 0) phases.resistance = { lines: resistanceLines };

    // Before the breath
    const btbLines = extractPhaseDialogue(block, 'before_the_breath');
    if (btbLines.length > 0) phases.before_the_breath = { lines: btbLines };

    // Breathing round cues
    const roundCues = extractBreathingCues(block);
    if (roundCues.length > 0) phases.breathing = { round_cues: roundCues };

    // Shift moment
    const shiftLines = extractPhaseDialogue(block, 'shift_moment');
    if (shiftLines.length === 0) {
      const shiftAlt = extractPhaseDialogue(block, 'shift');
      if (shiftAlt.length > 0) phases.shift_moment = { lines: shiftAlt };
    } else {
      phases.shift_moment = { lines: shiftLines };
    }

    // Close
    const closeLines = extractPhaseDialogue(block, 'close');
    if (closeLines.length > 0) phases.close = { lines: closeLines };

    // Vault prompt
    const vaultPrompt = extractVaultPrompt(block);
    if (vaultPrompt) phases.vault = { prompt: vaultPrompt };

    if (Object.keys(phases).length > 0) {
      sessions[sessionNum] = { title, phases, source: filename };
    }
  }

  return sessions;
}

function extractPhaseDialogue(block, phaseName) {
  // Find the phase section in the YAML block
  // Pattern: phaseName:\n  dialogue:\n    - speaker: "luno"\n      text: "..."
  const phaseRegex = new RegExp(
    `^${phaseName}:\\s*\\n(?:.*?\\n)*?\\s+dialogue:\\s*\\n((?:\\s+-\\s+speaker:.*?\\n\\s+text:.*?\\n)+)`,
    'mi'
  );

  const match = block.match(phaseRegex);
  if (!match) return [];

  const dialogueBlock = match[1];
  const lines = [];

  // Extract each speaker/text pair
  const lineRegex = /speaker:\s*"?(\w+)"?\s*\n\s+text:\s*"?(.*?)"?\s*$/gm;
  let lineMatch;
  while ((lineMatch = lineRegex.exec(dialogueBlock)) !== null) {
    const speaker = lineMatch[1];
    let text = lineMatch[2].trim();
    // Remove trailing quote if present
    if (text.endsWith('"')) text = text.slice(0, -1);
    lines.push({ speaker, text });
  }

  return lines;
}

function extractBreathingCues(block) {
  const cues = [];
  // Look for luno_breath section with round_N entries
  const breathMatch = block.match(/luno_breath:\s*\n((?:.*?\n)*?)(?=\n\S|\n\n\S|$)/mi);
  if (breathMatch) {
    const breathBlock = breathMatch[1];
    const roundRegex = /round_\d+:\s*"?(.*?)"?\s*$/gm;
    let roundMatch;
    while ((roundMatch = roundRegex.exec(breathBlock)) !== null) {
      let cue = roundMatch[1].trim();
      if (cue.endsWith('"')) cue = cue.slice(0, -1);
      if (cue) cues.push(cue);
    }
  }

  // Also check pendulation_cues (condensed format)
  if (cues.length === 0) {
    const pendMatch = block.match(/pendulation_cues:\s*\n((?:.*?\n)*?)(?=\n\S{1,20}:|\n\n\S|$)/mi);
    if (pendMatch) {
      const pendBlock = pendMatch[1];
      const touchRegex = /touch:\s*"?(.*?)"?\s*$/gm;
      let touchMatch;
      while ((touchMatch = touchRegex.exec(pendBlock)) !== null) {
        let cue = touchMatch[1].trim();
        if (cue.endsWith('"')) cue = cue.slice(0, -1);
        if (cue) cues.push(cue);
      }
    }
  }

  return cues;
}

function extractVaultPrompt(block) {
  // Look for vault_prompt or vault.prompt
  const vaultMatch = block.match(/vault_prompt:\s*"?(.*?)"?\s*$/mi) ||
                     block.match(/vault:\s*\n\s+prompt:\s*"?(.*?)"?\s*$/mi);
  if (vaultMatch) {
    let prompt = vaultMatch[1].trim();
    if (prompt.endsWith('"')) prompt = prompt.slice(0, -1);
    return prompt;
  }
  return null;
}

function escapeSQL(str) {
  return str.replace(/'/g, "''");
}

function generateSQL(sessions, rangeMin, rangeMax) {
  const lines = [];
  const sortedNums = Object.keys(sessions).map(Number).sort((a, b) => a - b);

  for (const num of sortedNums) {
    if (num < rangeMin || num > rangeMax) continue;
    const session = sessions[num];
    const json = JSON.stringify(session.phases, null, 2);
    const escapedJson = escapeSQL(json);

    lines.push(`-- ── SESSION ${num}: ${session.title} ── (source: ${session.source})`);
    lines.push(`UPDATE session_templates SET dialogue_phases = '${escapedJson}'::jsonb WHERE session_number = ${num};`);
    lines.push('');
  }

  return lines.join('\n');
}

// Main
const files = fs.readdirSync(INPUT_DIR)
  .filter(f => f.endsWith('.md') && f.includes('Sessions'))
  .sort((a, b) => getFilePriority(a) - getFilePriority(b));

console.error('Processing files (priority order):');
files.forEach(f => console.error(`  ${getFilePriority(f)}: ${f}`));

// Parse all files, higher priority overwrites lower
const allSessions = {};

// Process in REVERSE priority order so higher priority overwrites
const reversedFiles = [...files].reverse();
for (const file of reversedFiles) {
  const content = fs.readFileSync(path.join(INPUT_DIR, file), 'utf8');
  const sessions = parseMarkdown(content, file);
  for (const [num, data] of Object.entries(sessions)) {
    allSessions[num] = data;
  }
}

// Then process in priority order (overwrites)
for (const file of files) {
  const content = fs.readFileSync(path.join(INPUT_DIR, file), 'utf8');
  const sessions = parseMarkdown(content, file);
  for (const [num, data] of Object.entries(sessions)) {
    // Only overwrite if the new source has more phases
    const existing = allSessions[num];
    if (!existing || Object.keys(data.phases).length >= Object.keys(existing.phases).length) {
      allSessions[num] = data;
    }
  }
}

const sql = generateSQL(allSessions, rangeMin, rangeMax);
console.log(sql);

// Summary to stderr
const count = Object.keys(allSessions).filter(n => Number(n) >= rangeMin && Number(n) <= rangeMax).length;
console.error(`\nGenerated SQL for ${count} sessions (S${rangeMin}-S${rangeMax})`);
