# WeBrain

> 项目组 **AI 全能助手**（AI-Omni + WeBrain + baidu-search）· 本地 AI / 双脑架构 · AI-Omni 依赖
> 文档时点：**2026-08-27**。集群问题指向 [`../ToIV/AGENTS.md`](../ToIV/AGENTS.md)。本文不复制凭据。

双脑架构的本地 AI 集成平台：主脑负责深度推理与 L1–L4 记忆，副脑负责工具执行。AI-Omni 复用其决策大脑（Hermes），且约定 **WeBrain 核心代码只读不改**。

## Git 状态（已核实）

**本文件夹根目录不是 git 仓库**（2026-08-27 `git -C WeBrain` 失败，与登记册「❌ 非 git」一致）。

子目录带独立 `.git`：

| 目录 | 远程 |
|------|------|
| webrain-integration/ | origin = https://github.com/zhwangsir/WeBrain.git （活跃开发） |
| webrain-core/ | 有 .git，本机未见 origin |
| webrain-hermes/ | 有 .git |
| hermes-agent-main/、openclaw-main/ | 非 git（vendored 快照） |

GitHub 上存在 zhwangsir/WeBrain。**不要把未核实的 PR 写成已合并**（含历史上停滞的 PR）。本伞形目录没有 Gitee origin。

DEVELOPMENT.md：仅 `webrain-integration/` 可改；`openclaw-main/`、`webrain-hermes/`、`hermes-agent-main/` 只读、不可修改。

## 架构（DEVELOPMENT.md）

前端永不直连主脑；主脑接口经副脑 `/brain/*` 代理。

- 前端：React 18 + Vite + Ant Design 5，开发端口 8587
- 副脑：Node.js 22+ / Fastify / TypeScript，规范端口 3000（旧文档 9797 与 3456 过时）
- 主脑：Python 3.9+（推荐 3.11）/ FastAPI / Uvicorn / SQLite FTS5
- 测试：Vitest + Playwright + pytest
- 主脑默认 UDS 路径见 DEVELOPMENT.md；TCP 回退端口 18790
- 部署：Docker Compose（main-brain / sub-brain / frontend / dokobot）
- 通信协议刻意无鉴权、CORS 全开、无速率限制（个人本地部署）。不建议跨网络暴露。
- webrain-integration/README 仍可能写副脑 3456，以 DEVELOPMENT 规范端口 3000 为准

## 核心能力

- 智能对话：SSE、多会话、语音输入、文件拖拽、模型切换、工具开关
- 四级记忆：L1 会话 → L2 日归档 → L3 主题聚合 → L4 永久知识
- 知识图谱与 Wiki
- 工具与插件：Web 搜索、Playwright、代码执行、文件/终端、Docker 沙箱、插件 SDK
- 系统管理：仪表盘、Cron、多通道、智能体管理
- UX：深浅主题、PWA、命令面板

## 目录（伞形，非 monorepo）

```
WeBrain/
├── webrain-integration/   # 活跃开发：frontend + sub-brain + 嵌入的 main-brain
├── webrain-core/          # 本机存在；AI-Omni STATE 记为 webrain_core 上游路径
├── webrain-hermes/        # Hermes 上游参考（含 WeBrain 适配文件，只读）
├── hermes-agent-main/     # Hermes 更早/更纯净快照（只读）
├── openclaw-main/         # OpenClaw 上游参考（只读，副脑未直接 import）
├── AGENTS.md / DEVELOPMENT.md / STATE.json / TEST_LOG.md
└── README.md
```

启动步骤与环境变量表见 DEVELOPMENT.md（副脑可自动 spawn 主脑；WEBRAIN_NO_MAIN_BRAIN=1 可关闭）。LLM 配置落在用户目录的 model-config.json，**禁止把 apiKey 写入仓库或 README**。

## 与其它项目

- AI-Omni：插件化助手，依赖 WeBrain 大脑，不改本仓库核心
- baidu-search：搜索 Skill，可被 Hermes/WeBrain 技能目录引用
- LoveStar / WineryBlog 等无直接代码依赖

## 文档

- AGENTS.md — 本项目规则
- DEVELOPMENT.md — 开发/目录/端口/注意事项（权威细节）
- STATE.json / TEST_LOG.md — 2026-08-27 文档治理快照
- webrain-integration/README.md — 集成子树用户说明（端口以 DEVELOPMENT 为准）
- ../ToIV/AGENTS.md — 集群真相源
