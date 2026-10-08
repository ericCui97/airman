#!/usr/bin/env node
// airman — UserPromptSubmit hook to track the active mode.
// Recognizes:
//   /airman standard|terse|radio|off   (English)
//   回复风格 标准|精简|电报             (Chinese)
//   /airman-review                     (audit mode)
//   stop airman / 正常模式              (deactivation)

const { getDefaultMode, isDeactivationCommand, resolveToken } = require('./airman-config');
const { clearMode, setMode, writeHookOutput } = require('./airman-runtime');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input.replace(/^﻿/, ''));
    const prompt = (data.prompt || '').trim();
    const lower = prompt.toLowerCase();

    let mode = null;

    // Slash-style command: /airman, @airman, $airman
    const slashMatch = lower.match(/^[/@$]airman[\w-]*/);
    if (slashMatch) {
      const cmd = slashMatch[0].replace(/^[@$]/, '/');
      const parts = lower.split(/\s+/);
      const arg = parts[1] || '';

      if (cmd === '/airman-review') {
        mode = 'review';
      } else if (cmd === '/airman') {
        mode = arg ? resolveToken(arg) : getDefaultMode();
      }
    }

    // Chinese command: 回复风格 标准|精简|电报
    const cnMatch = prompt.match(/^回复风格\s+(\S+)/);
    if (cnMatch) {
      mode = resolveToken(cnMatch[1]);
    }

    if (mode && mode !== 'off') {
      setMode(mode);
      writeHookOutput('UserPromptSubmit', mode, 'AIRMAN MODE CHANGED — level: ' + mode);
      return;
    }
    if (mode === 'off') {
      clearMode();
      writeHookOutput('UserPromptSubmit', 'off', 'AIRMAN MODE OFF');
      return;
    }

    // Standalone deactivation.
    if (isDeactivationCommand(prompt)) {
      clearMode();
      writeHookOutput('UserPromptSubmit', 'off', 'AIRMAN MODE OFF');
    }
  } catch (e) {
    // Silent fail.
  }
});
