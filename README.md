# Airman

**Talk like an airman.** 像飞行员通话一样回复：清晰、简短、无歧义。

Airman 是一个 AI 中文回复风格技能。它把航空业的写作标准 ASD-STE100（简化技术英语）和飞行员无线电通话纪律，应用到 AI 的每一条中文回复上：

- 答案先行，废话删除
- 技术事实逐字保留
- 不编造，不确定就明说

## 为什么需要它

AI 的默认回复常常：

- 结论藏在最后，前面全是铺垫
- "好的以下是""希望有所帮助"之类的仪式
- 一句话塞进多个动作和被动语态
- 用"可能也许"堆砌，或者干脆编造

飞行员通话没有这些问题。塔台和驾驶舱之间，每句话都短、标准、无歧义——读错一句的代价很高。Airman 让 AI 按同样的纪律写作。

## 三档强度

| 档位 | 写法 |
|---|---|
| `standard`（默认） | 完整规则。完整语法，长短句结合，复杂内容分点 |
| `terse`（精简） | 删除一切铺垫、复述和收尾，允许片段句；技术内容逐字保留 |
| `radio`（电报） | 极限短句，命令式，仅用于终端排障等纯技术场景 |

安全警告、不可逆操作、用户困惑、内容要存到聊天之外时，任何档位都先用完整句子。

## 安装

### Claude Code（插件，支持自动注入与档位持久化）

```
/plugin marketplace add cuiyirong/airman
/plugin install airman@airman
```

### 手动安装

```bash
git clone https://github.com/cuiyirong/airman ~/.claude/plugins/airman
```

### Zed / 读取 AGENTS.md 的平台

把本仓库放进工作区，或复制 `AGENTS.md` 到项目根目录。Zed 的 Agent Panel 会自动加载它。

### 其他平台

将 `skills/airman/` 复制到平台的 skill 目录；不支持 skill 的平台使用 `AGENTS.md`。

## 使用

会话开始时规则自动注入，每条回复生效。

```
/airman standard      # 标准档（默认）
/airman terse         # 精简档
/airman radio         # 电报档
/airman off           # 关闭
/airman status        # 查询状态
/airman-review        # 审计一条回复，只报告不重写
```

中文口令同样有效："回复风格 标准|精简|电报"。关闭："正常模式"或"stop airman"。

## 项目结构

```
airman/
├── skills/airman/SKILL.md   # 完整回复指南：规则、档位、示例、检查清单
├── AGENTS.md                # 常驻精简版，供 Zed 等平台自动读取
├── hooks/                   # 注入运行时（SessionStart / UserPromptSubmit / SubagentStart）
├── commands/                # slash 命令：/airman、/airman-review
├── .claude-plugin/          # Claude Code 插件与市场清单
└── docs/
```

## 与同类项目的关系

- [Ponytail](https://github.com/DietrichGebert/ponytail)：管"写什么代码"——YAGNI、标准库优先、最少 diff
- [Caveman](https://github.com/JuliusBrussee/caveman)：管"怎么说话"——压缩叙述、保留事实
- **Airman**：管"中文回复怎么说"——以 STE100 为规则底座，用航空通话纪律组织回复

三者正交，可以同时安装。

## 路线图

- [x] 核心指南 + 三档强度
- [x] Claude Code hooks 注入与档位持久化
- [x] AGENTS.md 常驻版
- [ ] MCP Server（按需取回规则）
- [ ] 更多平台适配（OpenCode、Codex、pi）
- [ ] 回复压缩率基准（自行实测，不引用未经复测的数字）

## 许可证

MIT — 见 [LICENSE](LICENSE)。
