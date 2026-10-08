#!/usr/bin/env node
// airman — Claude Code SubagentStart hook
//
// SessionStart context is parent-thread only and never reaches subagents.
// When airman mode is active, inject the same ruleset into each subagent.

const { getAirmanInstructions } = require('./airman-instructions');
const { readMode, writeHookOutput } = require('./airman-runtime');

const mode = readMode();

// Absent flag or off → airman isn't active; inject nothing.
if (!mode || mode === 'off') {
  process.exit(0);
}

try {
  writeHookOutput('SubagentStart', mode, getAirmanInstructions(mode));
} catch (e) {
  // Silent fail — a stdout error at hook exit must not surface as a failure.
}
