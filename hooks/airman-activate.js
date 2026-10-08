#!/usr/bin/env node
// airman — Claude Code SessionStart activation hook
//
// Runs on every session start:
//   1. Writes flag file at $CLAUDE_CONFIG_DIR/.airman-active (statusline reads this)
//   2. Emits airman ruleset (filtered to default intensity) as hidden context
//   3. Detects missing statusline config and emits a setup nudge

const fs = require('fs');
const path = require('path');
const { getDefaultMode, getClaudeDir, isShellSafe } = require('./airman-config');
const { getAirmanInstructions } = require('./airman-instructions');
const {
  clearMode,
  isCodex,
  isCopilot,
  setMode,
  writeHookOutput,
} = require('./airman-runtime');

const claudeDir = getClaudeDir();
const settingsPath = path.join(claudeDir, 'settings.json');

const mode = getDefaultMode();

// "off" mode — skip activation entirely.
if (mode === 'off') {
  clearMode();
  const hookOutput = (isCodex || isCopilot) ? '' : 'OK';
  writeHookOutput('SessionStart', 'off', hookOutput);
  process.exit(0);
}

// 1. Write flag file
try {
  setMode(mode);
} catch (e) {
  // Flag is best-effort — don't block the hook.
}

// 2. Emit the airman ruleset, filtered to the active intensity.
let output = getAirmanInstructions(mode);

// 3. Detect missing statusline config — nudge setup.
if (!isCodex && !isCopilot) try {
  let hasStatusline = false;
  if (fs.existsSync(settingsPath)) {
    const raw = fs.readFileSync(settingsPath, 'utf8').replace(/^﻿/, '');
    const settings = JSON.parse(raw);
    if (settings.statusLine) hasStatusline = true;
  }

  if (!hasStatusline) {
    const isWindows = process.platform === 'win32';
    const scriptName = isWindows ? 'airman-statusline.ps1' : 'airman-statusline.sh';
    const scriptPath = path.join(__dirname, scriptName);
    if (isShellSafe(scriptPath)) {
      const command = isWindows
        ? `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
        : `bash "${scriptPath}"`;
      const statusLineSnippet =
        '"statusLine": { "type": "command", "command": ' + JSON.stringify(command) + ' }';
      output += "\n\n" +
        "STATUSLINE SETUP NEEDED: The airman plugin includes a statusline badge showing the active mode " +
        "(e.g. [AIRMAN], [AIRMAN:RADIO]). It is not configured yet. " +
        "To enable, add this to ~/.claude/settings.json: " +
        statusLineSnippet + " " +
        "Proactively offer to set this up for the user on first interaction.";
    } else {
      output += "\n\n" +
        "STATUSLINE SETUP NEEDED: Install path contains characters unsafe to embed in a shell command. " +
        "Configure the statusline by hand to run " + scriptName + " from the plugin's hooks directory.";
    }
  }
} catch (e) {
  // Silent fail — don't block session start over statusline detection.
}

try {
  writeHookOutput('SessionStart', mode, output);
} catch (e) {
  // stdout closed/EPERM at hook exit must not surface as a failure.
}
