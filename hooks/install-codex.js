#!/usr/bin/env node
// Install airman hooks into ~/.codex/hooks.json.
// Merges with existing hooks (never overwrites); backs up to hooks.json.bak-airman.
// Idempotent: re-running replaces previously installed airman groups only.

const fs = require('fs');
const os = require('os');
const path = require('path');

const CODEX_DIR = path.join(os.homedir(), '.codex');
const HOOKS_PATH = path.join(CODEX_DIR, 'hooks.json');

const commandFor = (script) =>
  `AIRMAN_HOST=codex node "${path.join(__dirname, script)}"; exit 0`;

const groupsToInstall = {
  SessionStart: [
    {
      hooks: [
        {
          type: 'command',
          command: commandFor('airman-activate.js'),
          timeout: 10,
          statusMessage: 'Loading airman mode...',
        },
      ],
    },
  ],
  UserPromptSubmit: [
    {
      hooks: [
        {
          type: 'command',
          command: commandFor('airman-mode-tracker.js'),
          timeout: 5,
          statusMessage: 'Tracking airman mode...',
        },
      ],
    },
  ],
  SubagentStart: [
    {
      hooks: [
        {
          type: 'command',
          command: commandFor('airman-subagent.js'),
          timeout: 10,
          statusMessage: 'Loading airman mode...',
        },
      ],
    },
  ],
};

function isAirmanGroup(group) {
  return Boolean(
    group?.hooks?.some((handler) =>
      String(handler.command || '').includes('airman-'),
    ),
  );
}

fs.mkdirSync(CODEX_DIR, { recursive: true });

let config = { hooks: {} };
if (fs.existsSync(HOOKS_PATH)) {
  config = JSON.parse(fs.readFileSync(HOOKS_PATH, 'utf8'));
}
fs.writeFileSync(
  HOOKS_PATH + '.bak-airman',
  JSON.stringify(config, null, 2),
);

config.hooks = config.hooks || {};
for (const [event, newGroups] of Object.entries(groupsToInstall)) {
  const kept = (config.hooks[event] || []).filter(
    (group) => !isAirmanGroup(group),
  );
  config.hooks[event] = [...kept, ...newGroups];
}

fs.writeFileSync(HOOKS_PATH, JSON.stringify(config, null, 2) + '\n');
console.log('airman hooks merged into', HOOKS_PATH);
