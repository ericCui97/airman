#!/usr/bin/env node
// airman — shared configuration resolver
//
// Default-mode resolution:
//   1. AIRMAN_DEFAULT_MODE environment variable
//   2. Config file defaultMode field:
//      - $XDG_CONFIG_HOME/airman/config.json
//      - ~/.config/airman/config.json (macOS / Linux)
//      - %APPDATA%\airman\config.json (Windows)
//   3. 'standard'
//
// Chinese aliases: 标准=standard, 精简=terse, 电报=radio

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_MODE = 'standard';
const VALID_MODES = ['off', 'standard', 'terse', 'radio', 'review'];
const RUNTIME_MODES = ['off', 'standard', 'terse', 'radio'];
const CN_ALIASES = { '标准': 'standard', '精简': 'terse', '电报': 'radio' };

function resolveToken(token) {
  if (typeof token !== 'string') return null;
  const t = token.trim().toLowerCase();
  if (RUNTIME_MODES.includes(t)) return t;
  if (CN_ALIASES[token.trim()]) return CN_ALIASES[token.trim()];
  return null;
}

function normalizeMode(mode) {
  return resolveToken(mode);
}

function normalizeConfigMode(mode) {
  if (typeof mode !== 'string') return null;
  const t = mode.trim().toLowerCase();
  return VALID_MODES.includes(t) ? t : null;
}

function normalizePersistedMode(mode) {
  return normalizeMode(mode) || normalizeConfigMode(mode);
}

// Deactivation only as a standalone command — matching the phrase anywhere in
// a message would turn airman off mid-task.
function isDeactivationCommand(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[.!?\s]+$/, '');
  return t === 'stop airman' || t === '正常模式';
}

// Only embed the plugin path in a statusline command when it uses ordinary
// path characters. A hostile clone path falls back to manual setup.
function isShellSafe(p) {
  return typeof p === 'string' && /^[A-Za-z0-9 _.\-:/\\~]+$/.test(p);
}

function getConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'airman');
  }
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'airman'
    );
  }
  return path.join(os.homedir(), '.config', 'airman');
}

function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

function getClaudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function getDefaultMode() {
  const envMode = process.env.AIRMAN_DEFAULT_MODE;
  if (envMode) {
    const resolved = resolveToken(envMode) || normalizeConfigMode(envMode);
    if (resolved && resolved !== 'review') return resolved;
  }

  try {
    const config = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
    if (config.defaultMode && VALID_MODES.includes(String(config.defaultMode).toLowerCase())) {
      return String(config.defaultMode).toLowerCase();
    }
  } catch (e) {
    // Config file missing or invalid — fall through.
  }

  return DEFAULT_MODE;
}

function writeDefaultMode(mode) {
  const normalized = normalizeConfigMode(mode);
  if (!normalized) return null;

  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ defaultMode: normalized }, null, 2), 'utf8');
  return normalized;
}

module.exports = {
  DEFAULT_MODE,
  VALID_MODES,
  RUNTIME_MODES,
  CN_ALIASES,
  getDefaultMode,
  getConfigDir,
  getConfigPath,
  getClaudeDir,
  isShellSafe,
  resolveToken,
  normalizeMode,
  normalizeConfigMode,
  normalizePersistedMode,
  isDeactivationCommand,
  writeDefaultMode,
};
