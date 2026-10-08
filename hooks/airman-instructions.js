#!/usr/bin/env node
// Shared Airman instruction builder for hooks.
//
// Reads skills/airman/SKILL.md, strips the frontmatter, and filters the
// intensity table rows and three-mode example to the active level. Every
// other rule is kept verbatim. Falls back to a built-in compact text if the
// skill file cannot be read.

const fs = require('fs');
const path = require('path');
const { DEFAULT_MODE, normalizeMode, normalizePersistedMode } = require('./airman-config');

const INDEPENDENT_MODES = new Set(['review']);
const SKILL_PATH = path.join(__dirname, '..', 'skills', 'airman', 'SKILL.md');

function _modeAtStart(text) {
  const m = String(text || '').toLowerCase().match(/^(standard|terse|radio)\b/);
  return m ? m[1] : null;
}

function filterSkillBodyForMode(body, mode) {
  const effectiveMode = normalizeMode(mode) || DEFAULT_MODE;
  const withoutFrontmatter = String(body || '').replace(/^---[\s\S]*?---\s*/, '');

  return withoutFrontmatter
    .split(/\r?\n/)
    .filter((line) => {
      // Intensity table: "| **standard**（标准，默认） | ..."
      const tableRow = line.match(/^\|\s*\*\*(.+?)\*\*/);
      if (tableRow) {
        const rowMode = _modeAtStart(tableRow[1]);
        if (rowMode) return rowMode === effectiveMode;
      }

      // Example 5 labels: "**standard：**" / "**terse:**"
      const exampleRow = line.match(/^\*\*(.+?)\*\*/);
      if (exampleRow && /^[\s>*]*\*\*/.test(line)) {
        const rowMode = _modeAtStart(exampleRow[1]);
        if (rowMode) return rowMode === effectiveMode;
      }

      return true;
    })
    .join('\n');
}

function getFallbackInstructions(mode) {
  return 'AIRMAN MODE ACTIVE — level: ' + mode + '\n\n' +
    'Talk like an airman. 回复清晰、简短、无歧义：答案先行，废话删除，技术事实逐字保留。\n\n' +
    '## Persistence\n\n' +
    'ACTIVE EVERY RESPONSE. 每条回复生效，不漂移。Off only: "stop airman" / "正常模式".\n\n' +
    'Current level: **' + mode + '**. Switch: `/airman standard|terse|radio`（标准|精简|电报）.\n\n' +
    '## Rules\n\n' +
    '先结论后展开。不写问候、客套、复述、收尾。不编造，不确定明说。\n' +
    '一词一义。用动词不用名词化。每句一个意思：指令 ≤20 字，说明 ≤25 字。\n' +
    '主动语态；指令用命令式；条件在命令之前。\n' +
    '代码、命令、路径、数字、报错逐字保留；否定词不删。\n' +
    '安全警告、不可逆操作、用户困惑、内容持久化到聊天之外时，先用完整句子。';
}

function getAirmanInstructions(mode) {
  const configuredMode = normalizePersistedMode(mode) || DEFAULT_MODE;

  if (INDEPENDENT_MODES.has(configuredMode)) {
    return 'AIRMAN MODE ACTIVE — level: review. Behavior defined by /airman-review.';
  }

  const effectiveMode = normalizeMode(configuredMode) || DEFAULT_MODE;

  try {
    return 'AIRMAN MODE ACTIVE — level: ' + effectiveMode + '\n\n' +
      filterSkillBodyForMode(fs.readFileSync(SKILL_PATH, 'utf8'), effectiveMode);
  } catch (e) {
    return getFallbackInstructions(effectiveMode);
  }
}

module.exports = {
  filterSkillBodyForMode,
  getFallbackInstructions,
  getAirmanInstructions,
};
