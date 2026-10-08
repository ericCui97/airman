# MyFlicker Hooks 开发指南

MyFlicker Hooks 是在 Agent 生命周期关键节点自动触发的外部处理器。本文覆盖配置注入、
事件契约、脚本编写、返回值语义、日志排障五部分；按「先选事件 → 再写配置 → 最后写脚本」
的顺序阅读即可完成一次注入。

---

## 一、注入一个 Hook 的最短路径

三步完成注入，不需要修改 MyFlicker 源码：

1. **选事件**：从第二节表格中挑一个触发时机，确认它是否可阻断。
2. **写配置**：在 `~/.myflicker/settings.json`（个人全局）或 `.myflicker/settings.json`
   （项目共享）的 `hooks` 字段下追加一个 HookGroup。
3. **写脚本**：`type: command` 时提供可执行命令，脚本从 stdin 读 JSON、向 stdout 写
   HookResult。

最小可用示例（拦截危险 shell 命令）：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "execute_command",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.myflicker/myflicker-hooks/dangerous-command-check.js",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

```javascript
#!/usr/bin/env node
async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

  const command = String(payload.tool_input?.command ?? '');
  if (/rm\s+-rf\s+\//.test(command)) {
    process.stderr.write(`危险命令被阻断: ${command}`);
    process.exit(2); // 2 = 阻断
  }

  process.stdout.write(JSON.stringify({ continue: true }) + '\n');
}
main().catch((error) => {
  process.stderr.write(String(error) + '\n');
  process.exit(1);
});
```

改完配置需要重启会话或等待 MyFlicker 重载配置，只改脚本文件则立即生效。

---

## 二、事件清单

### 已实装事件（产品代码会触发）

| 事件 | 触发时机 | matcher 匹配目标 | 可否阻断 | payload 关键字段 |
| --- | --- | --- | --- | --- |
| `SessionStart` | Agent 会话开始（prompt 入口） | `startup` / `resume` | 否 | `source`, `agentMode` |
| `UserPromptSubmit` | 用户提交 prompt 后、任务执行前 | — | **是** | `prompt` |
| `PreToolUse` | 工具执行前（所有工具） | 工具名 | **是** | `tool_name`, `tool_input`, `tool_use_id` |
| `PostToolUse` | 工具执行成功后 | 工具名 | 否（可追加文案） | `tool_name`, `tool_input`, `tool_response`, `tool_use_id` |
| `PostToolUseFailure` | 工具执行失败后 | 工具名 | 否 | `tool_name`, `error` |
| `SubagentStart` | 子 Agent 启动前 | subagent 类型名 | 否 | `agent_id`, `agent_type` |
| `SubagentStop` | 子 Agent 正常结束后 | subagent 类型名 | 否（返回值未消费） | `agent_id`, `agent_type` |
| `Stop` | Agent 任务成功完成时 | — | **是** | `last_assistant_message`, `tool_call_count`, `tool_error_count`, `debug_server_port` |
| `StopFailure` | 任务非正常停止（API 错误、限流、最大迭代数等） | — | 否 | `stop_reason_type`, `stop_reason_message`, `tool_call_count`, `tool_error_count`, `debug_server_port` |
| `PreCompact` | 上下文压缩开始前 | `auto` / `manual` | 否 | `trigger` |
| `PostCompact` | 上下文压缩完成后 | `auto` / `manual` | 否 | `trigger`, `compact_summary` |
| `SessionEnd` | 会话结束（finally 块） | — | 否 | `transcript_path` |

### 类型已支持但当前不触发

以下事件在类型定义中存在，但产品逻辑尚未触发，配置后不会生效：
`PermissionRequest`、`Notification`、`TaskCreated`、`TaskCompleted`、`TeammateIdle`、
`InstructionsLoaded`、`ConfigChange`、`CwdChanged`、`FileChanged`、`WorktreeCreate`、
`WorktreeRemove`、`Elicitation`、`ElicitationResult`。

### 通用 payload 字段

所有事件都包含以下字段：

```typescript
interface HookBaseInput {
  session_id: string;
  cwd: string;
  hook_event_name: string;
  transcript_path?: string; // 预留，当前不填充
  permission_mode?: string; // 预留，当前不填充
}
```

### 工具类事件的 matcher 用法

`PreToolUse` / `PostToolUse` / `PostToolUseFailure` 的 `matcher` 是**正则表达式**，匹配工具名：

```jsonc
{ "matcher": "execute_command", ... }                    // 精确匹配
{ "matcher": "write_to_file|replace_in_file", ... }      // 正则多选
{ "hooks": [ ... ] }                                     // 不填 = 匹配所有工具
```

常用工具名：`execute_command`、`write_to_file`、`replace_in_file`、
`multi_replace_in_file`、`read_file`、`list_files`、`search_files`、
`codebase_search`、`create_plan`。

---

## 三、配置文件

### 路径与优先级

同一事件的规则**全部注册**（不覆盖），按文件优先级从低到高依次执行：

| 优先级 | 路径 | 用途 | 是否提交 git |
| --- | --- | --- | --- |
| 1 | `~/.myflicker/settings.json` | 个人全局，所有项目生效 | 否 |
| 2 | `~/.claude/settings.json` | Claude Code 全局兼容 | 否 |
| 3 | `{cwd}/.myflicker/settings.json` | 团队共享规则 | 是 |
| 4 | `{cwd}/.myflicker/settings.local.json` | 个人项目规则 | 否 |
| 5 | `{cwd}/.claude/settings.json` | Claude Code 项目级兼容 | 按需 |
| 6 | `{cwd}/.claude/settings.local.json` | Claude Code 本地兼容 | 否 |
| 7 | `{cwd}/.cursor/hooks.json` | Cursor 项目级兼容 | 按需 |

### 配置结构

```jsonc
{
  "hooks": {
    "<HookEventName>": [
      {
        // HookGroup：matcher 可选，hooks 为 handler 数组
        "matcher": "execute_command",
        "hooks": [
          {
            "type": "command",
            "command": "node /absolute/path/to/script.js",
            "timeout": 30,
            "async": false
          }
        ]
      }
    ]
  }
}
```

### HookConfig 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | `command` \| `http` \| `prompt` \| `agent` | 是 | handler 类型 |
| `command` | string | `command` 必填 | shell 命令，payload 通过 stdin 传入 |
| `url` | string | `http` 必填 | HTTP POST 目标 |
| `headers` | Record | 否 | 请求头，支持 `$VAR` / `${VAR}` 插值 |
| `allowedEnvVars` | string[] | 否 | 允许插值的环境变量白名单；不设置则不插值 |
| `prompt` | string | `prompt` 必填 | 提示词（占位，暂不执行） |
| `timeout` | number | 否 | 超时秒数，默认 600 |
| `async` | boolean | 否 | `true` 时不阻塞主流程，stdout 不参与合并 |

`prompt` / `agent` 目前只解析配置并写日志，不会真正执行。

### 合并而非覆盖

追加新 hook 时必须先读取现有 JSON 再合并，不能直接覆写整个 `hooks` 对象。同日多个 group、
多个配置文件同时生效，低优先级先执行、高优先级后执行。

---

## 四、Handler 契约

### command 类型

```
stdin:  JSON payload（HookBaseInput + 事件特有字段）
stdout: JSON HookResult（可为空）
stderr: 错误信息；退出码 2 时作为 stopReason
退出码: 0 = 通过, 2 = 阻断, 其他 = 异常（不阻断，仅记录日志）
```

读取 stdin **必须**用异步迭代，禁止 `readFileSync('/dev/stdin')`，否则会阻塞或读到空：

```javascript
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
```

### http 类型

```
请求: POST {url}, Content-Type: application/json, Body = JSON payload
响应: Body = JSON HookResult（可为空）
      非 2xx 状态码 = 忽略，不阻断
```

### HookResult 结构

```typescript
interface HookResult {
  continue?: boolean;            // false = 阻断当前操作
  stopReason?: string;           // 阻断时展示给用户
  additionalContext?: string;    // 注入给 LLM 的额外上下文
  systemMessage?: string;        // 展示给用户的消息
  hookSpecificOutput?: {
    permissionDecision?: 'allow' | 'deny';   // PreToolUse 权限控制
    updatedInput?: Record<string, unknown>;  // PreToolUse 改写工具入参（深合并）
    replaceToolContextData?: string;         // PostToolUse 替换 contextData
  };
}
```

### 返回值速查

| 目标 | 写法 |
| --- | --- |
| 通过 | 退出码 0，stdout 空或 `{"continue":true}` |
| 阻断 | 退出码 **2**（stderr 作为 stopReason），或 `{"continue":false,"stopReason":"..."}` |
| 注入 LLM 上下文 | `{"continue":true,"additionalContext":"..."}` |
| 展示用户消息 | `{"systemMessage":"..."}` |
| 改写工具入参 | `{"hookSpecificOutput":{"updatedInput":{...}}}`，仅 PreToolUse |
| 替换工具返回 | `{"hookSpecificOutput":{"replaceToolContextData":"..."}}`，仅 PostToolUse 且响应含 `contextData` |

注意：阻断必须用退出码 **2**，退出码 1 只会被记为异常，不会阻断。

---

## 五、按事件注入

### SessionStart：注入环境上下文

适合把 git 分支、工作区状态、环境变量快照注入首条上下文。

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "node ~/.myflicker/myflicker-hooks/inject-git-context.js", "timeout": 30 }
        ]
      }
    ]
  }
}
```

```javascript
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

  try {
    const { stdout: branch } = await execFileAsync('git', ['branch', '--show-current'], { cwd: payload.cwd });
    const { stdout: status } = await execFileAsync('git', ['status', '--short'], { cwd: payload.cwd });
    const context = `Current git branch: ${branch.trim()}\nModified files:\n${status.trim() || '(clean)'}`;
    process.stdout.write(JSON.stringify({ continue: true, additionalContext: context }) + '\n');
  } catch {
    process.stdout.write(JSON.stringify({ continue: true }) + '\n');
  }
}
main().catch((error) => {
  process.stderr.write(String(error) + '\n');
  process.exit(1);
});
```

### UserPromptSubmit：提交前校验或改写上下文

可阻断，适合做敏感词/合规检查。payload 的 `prompt` 是用户原始输入。

```javascript
if (/\b(生产密码|access[_-]?key)\b/i.test(payload.prompt)) {
  process.stderr.write('提示词疑似包含凭据，请脱敏后重试。');
  process.exit(2);
}
process.stdout.write(JSON.stringify({ continue: true }) + '\n');
```

### PreToolUse：拦截与改写

三类用法：

- 拦截：`process.exit(2)` 或 `{"continue":false,"stopReason":"..."}`
- 权限决策：`{"hookSpecificOutput":{"permissionDecision":"allow"|"deny"}}`
- 改写参数：`{"hookSpecificOutput":{"updatedInput":{...}}}`，会深合并进原 `tool_input`

改写示例（给所有 shell 命令强制加超时）：

```javascript
const input = payload.tool_input ?? {};
if (typeof input.command === 'string' && !input.command.includes('timeout ')) {
  process.stdout.write(JSON.stringify({
    continue: true,
    hookSpecificOutput: { updatedInput: { command: `timeout 120 ${input.command}` } }
  }) + '\n');
} else {
  process.stdout.write(JSON.stringify({ continue: true }) + '\n');
}
```

### PostToolUse：审计与结果替换

文件写入审计建议用 `async: true`，避免拖慢主流程：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "write_to_file|replace_in_file|multi_replace_in_file",
        "hooks": [
          { "type": "command", "command": "node ~/.myflicker/myflicker-hooks/audit-logger.js", "async": true }
        ]
      }
    ]
  }
}
```

需要压缩超长工具输出时，用 `replaceToolContextData` 完整替换 `contextData`（仅当工具响应
结构含该字段时生效）：

```javascript
const text = String(payload.tool_response?.contextData ?? '');
process.stdout.write(JSON.stringify({
  continue: true,
  hookSpecificOutput: { replaceToolContextData: text.slice(0, 4000) }
}) + '\n');
```

### PostToolUseFailure：失败归因

拿到 `tool_name` 和 `error`，适合把失败样本写入自有观测系统。不能阻断，也不改变流程。

### SubagentStart / SubagentStop：子 Agent 观测

按 `agent_type` 做 matcher，可用于统计子 Agent 调用、耗时与产物。`SubagentStop` 的返回值
不会被消费，只做旁路记录。

### Stop：质量门

可阻断，是本系统最常用的「不合格就不许结束」入口。注意脚本要在通过时输出
`{"continue":true}`，失败时退出码 2：

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx eslint . --max-warnings 0 && echo '{\"continue\":true}' || (echo '{}' && exit 2)",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

### StopFailure：异常停止后的自动重试

payload 提供 `stop_reason_type`、`stop_reason_message` 和 `debug_server_port`。建议
`async: true`，避免在异常路径上再次阻塞。

```javascript
const { stop_reason_type, stop_reason_message, debug_server_port } = payload;
if (stop_reason_type === 'ApiRateLimited' || stop_reason_type === 'TokenRateLimited') {
  // 记录限流信息；如需自动重试，通过 debug_server_port 调用 Debug Server
  process.stderr.write(`Rate limited: ${stop_reason_message}\n`);
}
process.stdout.write(JSON.stringify({ continue: true }) + '\n');
```

### PreCompact / PostCompact：压缩前后留痕

matcher 为 `auto` / `manual`。`PostCompact` 的 `compact_summary` 可写入自有审计，用于复盘
上下文是如何被压缩的。

### SessionEnd：收尾清理

会话 finally 阶段触发，适合关闭临时服务、flush 日志、上报会话统计。不能阻断。

---

## 六、脚本模板

### Node.js（推荐）

```javascript
#!/usr/bin/env node
// Hook 脚本：<描述>
// 事件：<EventName>

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

  const { session_id, cwd, hook_event_name, tool_name, tool_input } = payload;

  // --- 业务逻辑 ---

  process.stdout.write(JSON.stringify({ continue: true }) + '\n');
}

main().catch((error) => {
  process.stderr.write(String(error) + '\n');
  process.exit(1);
});
```

### Shell（简单场景）

```bash
#!/bin/bash
# Hook 脚本：<描述>
# 事件：<EventName>

PAYLOAD=$(cat)
TOOL_NAME=$(echo "$PAYLOAD" | jq -r '.tool_name // ""')
COMMAND=$(echo "$PAYLOAD" | jq -r '.tool_input.command // ""')

# --- 业务逻辑 ---

echo '{"continue":true}'
exit 0
```

### 存放位置

- 个人脚本：`~/.myflicker/myflicker-hooks/`
- 项目脚本：`{project}/.myflicker/hooks/` 或 `{project}/scripts/hooks/`

配置里建议写绝对路径，避免工作目录变化导致找不到脚本。

---

## 七、日志与排障

### 日志位置

```bash
tail -f ~/.myflicker/hooks.jsonl          # 实时跟踪
tail -20 ~/.myflicker/hooks.jsonl | jq '.' # 最近 20 条
grep '"event":"PreToolUse"' ~/.myflicker/hooks.jsonl
grep '"exitCode":2' ~/.myflicker/hooks.jsonl   # 只看阻断
jq -r '.event' ~/.myflicker/hooks.jsonl | sort | uniq -c | sort -rn
```

日志字段：`ts`、`event`、`session_id`、`type`、`target`、`exitCode`、`stdout`（截断至
16384 字符）、`stderr`、`statusCode`、`error`。

只有通过 `settings.json` 加载的 `command` / `http` handler 会写日志；代码内
`globalHookRegistry.register()` 注册的内部 handler 不写日志。

### 常见问题

| 现象 | 检查方向 |
| --- | --- |
| Hook 没触发 | `enableHooks` 是否为 true；配置路径是否正确；是否重启会话触发配置重载 |
| 脚本 stdin 读取失败 | 必须用 `for await (const chunk of process.stdin)`，不能用 `readFileSync('/dev/stdin')` |
| 阻断不生效 | 退出码必须是 2，而不是 1；或使用 `{"continue":false}` |
| 超时 | `timeout` 单位是秒，默认 600 |
| 日志没有记录 | 只有配置文件加载的 handler 写日志 |
| 改写参数没生效 | `updatedInput` 只在 PreToolUse 生效，且是深合并 |
| 替换返回没生效 | `replaceToolContextData` 只在 PostToolUse 生效，且响应需含 `contextData` |

### 启停

在 IDE 设置的 Hooks 标签页切换 `enableHooks`，或直接搜索该配置项。
`enableHooks: false` 会清空 registry 并跳过所有配置型 handler，代码内部注册的 handler 不受影响。

---

## 八、设计建议

1. **可阻断事件保持快速**：`PreToolUse`、`UserPromptSubmit`、`Stop` 在关键路径上，
   把耗时逻辑改成 `async: true` 或移出阻断路径。
2. **脚本必须自兜底**：任何异常都写 stderr 并返回非 0/非 2，避免误阻断主流程。
3. **不要从 Hook 里再调用 MyFlicker**：会形成递归触发，建议只做纯计算、文件读写或外部 HTTP。
4. **输出只写一行 JSON**：stdout 会被当作 HookResult 解析，调试信息一律走 stderr。
5. **敏感信息脱敏**：payload 可能含命令、文件内容与提示词，落盘或上报前必须脱敏。
6. **日志用于排障而非审计主链路**：需要审计时写入自有存储，不要依赖 `hooks.jsonl` 的截断内容。
