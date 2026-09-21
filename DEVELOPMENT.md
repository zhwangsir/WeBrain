# DEVELOPMENT.md — WeBrain

> 合并自旧 PROJECT_INIT / docs / 根目录散文档。原文在 `ALLProject/.archive/docs-legacy-20260827/`。
> 最后更新：2026-08-27

# 原 PROJECT_INIT

# WeBrain · 项目初始化文档

> 由项目管理中枢自动生成 | 更新日期: 2026-07-12 | 负责人: zhwangsir

## 一、项目基本信息

| 字段 | 值 |
|------|----|
| 项目名称 | WeBrain（双脑架构 AI 集成平台） |
| 当前版本 | 未明确版本号（持续迭代，2026 年活跃开发中） |
| 创建日期 | 未明确记录（仓库提交历史可追溯） |
| 负责人 | zhwangsir |
| 项目路径 | /Users/wangzhenyu/Desktop/ALLProject/WeBrain |
| 远程仓库 | https://github.com/zhwangsir/WeBrain |
| 仓库可见性 | 公开（Public） |
| 线上地址 | 暂无（定位为个人本地部署） |

## 二、项目概述与核心功能

### 2.1 项目定位

WeBrain 是一个基于**双脑架构**的本地 AI 集成平台，核心理念是将"推理中心"与"执行中心"物理隔离：

- **主脑（Main Brain）**：Python / FastAPI，负责深度推理、L1-L4 四级记忆、知识图谱、Wiki、进化引擎、多模型路由。
- **副脑（Sub Brain）**：TypeScript / Fastify，负责工具执行、插件 / 通道 / 浏览器 / 沙箱 / MCP / CLI / SkillHub 等全部执行层能力。
- **前端（Frontend）**：React 18 + Vite + Ant Design 5，提供聊天、仪表盘、系统管理等 UI。

本仓库是一个**多项目伞形目录（umbrella，非 monorepo）**：仅 `webrain-integration/` 处于活跃开发；`openclaw-main/` 与 `webrain-hermes/`（及 `hermes-agent-main/`）为 vendored 上游参考，**只读、不可修改**。

### 2.2 核心功能列表

- **智能对话**：SSE 流式输出、Markdown 实时渲染、多会话管理、语音输入、文件拖拽上传、模型切换、工具调用开关。
- **四级记忆系统**：L1 会话级 → L2 日归档 → L3 主题聚合 → L4 永久知识；支持语义检索、HyDE 增强、反思循环、工作记忆、上下文压缩、语义去重、用户画像注入、KG 上下文注入、时态感知、记忆置信度 / 时效 / 来源多样性信号等 S 系列增强。
- **知识图谱与 Wiki**：自动提取实体关系；Markdown Wiki 笔记 with 全文搜索。
- **工具与插件**：内置 Web 搜索、浏览器自动化（Playwright）、代码执行、文件编辑、终端命令；Docker 沙箱隔离执行；TypeScript 插件 SDK（Hooks 生命周期）。
- **系统管理**：仪表盘实时健康监控、Cron 任务调度、多通道消息接入、智能体管理。
- **用户体验**：深浅主题、PWA 离线缓存、命令面板（Cmd+K / Cmd+/）、响应式布局。

### 2.3 目标用户

个人开发者与 AI 协作爱好者，需要一个**本地可部署、长记忆、可扩展、推理与执行隔离**的人机协作系统。定位为个人本地部署，主脑↔副脑通信协议**刻意无鉴权、CORS 全开、无速率限制**。

## 三、技术架构

### 3.1 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18, Vite 5, TypeScript 5（严格模式）, Ant Design 5, Zustand, react-markdown, framer-motion, react-router-dom v6 |
| 副脑（Sub Brain） | Node.js 22+, Fastify 4, TypeScript 5, Playwright, Dockerode, ESM, pino 日志, prom-client 指标 |
| 主脑（Main Brain） | Python 3.9+（推荐 3.11）, FastAPI, Uvicorn, SQLite + FTS5, sentence-transformers, torch, transformers, scikit-learn, numpy, networkx |
| 测试 | Vitest（前后端）, jsdom, @testing-library/react, Playwright（前端 E2E）, pytest + pytest-cov + pytest-asyncio（主脑） |
| 部署 | Docker + Docker Compose |
| 包管理 | pnpm（workspace 模式） |
| vendored 参考 | openclaw-main（Node/TS agent 框架）、webrain-hermes / hermes-agent-main（Python Hermes CLI agent） |

### 3.2 架构说明

```
Frontend (Vite, :8587)
    │ HTTP / WebSocket
    ▼
Sub Brain (Fastify+TS, :3000，规范端口；README 中 :3456 为另一端口说明)
    │ /brain/* 透传代理（无 allowlist，剥离 x-forwarded-*，保留 Authorization）
    ▼  UDS /tmp/webrain-main.sock（默认）或 TCP :18790（fallback）
Main Brain (FastAPI, Python)
    └─ memory / reasoning / evolution / decision / chat / wiki / canvas / planner / kg
```

关键架构事实：
- 前端**永不直连主脑**，所有主脑接口经副脑 `/brain/*` 代理。
- 副脑 `pnpm dev` 启动时会自动 spawn 主脑 Python 子进程（除非 `WEBRAIN_NO_MAIN_BRAIN=1`）；解释器优先级：`venv/bin/python3` > `WEBRAIN_PYTHON` > 系统 `python3`。
- LLM 配置支持热重载：`POST /config/reload`（或 `POST /config/model`）会让主脑重新拉取配置并传播到所有持有 `llm_config` 副本的引擎（chat / reasoning / planner / dreaming / kg / skill_reflector）。
- 多 LLM provider 模板：`sub-brain/main-brain/config/llm.example.json`，覆盖 OpenAI / Anthropic / Google Gemini / DeepSeek / Kimi / Groq / LM Studio / Ollama；支持 multi-endpoint failover。

### 3.3 核心依赖

- **前端**：react, antd, zustand, react-markdown, framer-motion, react-router-dom, axios, i18next。
- **副脑**：fastify, playwright, dockerode, pino, prom-client, tsx（ESM 运行）。
- **主脑**：fastapi, uvicorn, sentence-transformers, torch, transformers, scikit-learn, networkx, sqlite3 (FTS5)。
- **openclaw-main**：pnpm + Node 22+，TypeScript ESM 严格模式，Vitest 测试。
- **webrain-hermes**：Python 3.11+，uv 包管理（uv.lock），prompt_toolkit + Rich CLI，插件 / Skills / Cron / Kanban / Gateway 多平台适配。

## 四、目录结构

```
WeBrain/
├── CLAUDE.md                       # 伞形目录 scope 规则（仅 webrain-integration/ 可改）
├── webrain-integration/            # ★ 活跃开发目录（即"项目"本体）
│   ├── frontend/                   # React 前端（Vite + AntD，:8587）
│   │   ├── src/{pages,components,stores,api,hooks,utils,i18n,styles}
│   │   ├── e2e/                    # Playwright E2E
│   │   └── package.json
│   ├── sub-brain/                  # 副脑（Fastify + TS，:3000）
│   │   ├── src/{server,tools,channels,agent,browser,sandbox,skills,mcp,cli,plugin-sdk,plugins,config}
│   │   ├── main-brain/             # 主脑 Python 服务（嵌入 sub-brain 下）
│   │   │   ├── {chat,memory,reasoning,evolution,decision,planner,bridge,wiki,cron,canvas,media,mcp,tools,cache,observability}
│   │   │   ├── main_brain.py       # 主入口
│   │   │   ├── requirements.txt
│   │   │   └── tests/{smoke,fixtures}
│   │   ├── tests/
│   │   └── package.json
│   ├── tests/                      # 根集成测试（需 :3000 + /brain/health 存活）
│   ├── protocol/                   # 主脑↔副脑通信协议文档
│   ├── scripts/{verify-install.sh,backup-data.sh,seed-demo-data.sh}
│   ├── docker-compose.yml
│   ├── vitest.config.ts            # pool: "forks"，加载 tests/setup.ts + frontend/src/test-setup.ts
│   └── docs/{PROJECT_STATE.md,CONTRIBUTING.md,TEST_REPORT.md,USER_TRIAL_2026-05-20.md,adr/}
├── openclaw-main/                  # vendored 上游参考（只读，勿改）
│   ├── src/                        # 核心 TS（acp/agents/channels/cli/config/cron/gateway/hooks/infra/media/tools/tui）
│   ├── ui/                         # 控制面板 UI
│   ├── docs/                       # CLI / install / nodes / start / tools / web 文档
│   ├── skills/{gog,sag}/SKILL.md
│   ├── Makefile                    # 仅 `pnpm build`
│   ├── fly.toml                    # Fly.io 部署（app=openclaw，:3000，shared-cpu-2x 2GB）
│   ├── Dockerfile, docker-compose.yml, render.yaml
│   └── package.json, pnpm-workspace.yaml, tsconfig.*.json
├── webrain-hermes/                 # vendored 上游参考（只读，勿改）
│   ├── cli.py                      # Hermes CLI 入口（prompt_toolkit TUI + Rich）
│   ├── run_agent.py                # AIAgent 核心对话循环
│   ├── model_tools.py, toolsets.py # 工具编排与 toolset 定义
│   ├── hermes_state.py             # SessionDB（SQLite + FTS5）
│   ├── agent/, hermes_cli/, tools/, gateway/, plugins/, skills/, cron/, tui_gateway/, ui-tui/, web/, website/
│   ├── .envrc, .env.example, uv.lock, pyproject.toml
│   ├── Dockerfile, docker-compose.yml, flake.nix
│   └── RELEASE_v0.2.0.md ~ RELEASE_v0.13.0.md
├── hermes-agent-main/              # vendored 上游参考（只读）
└── webrain-integration/            # （上文已列）
```

### 关键文件功能说明

| 路径 | 功能 |
|------|------|
| `CLAUDE.md` | 伞形目录 scope 规则：仅 `webrain-integration/` 可编辑，其余只读 |
| `webrain-integration/README.md` | 用户面向的快速开始、架构图、端口说明、LLM 配置 |
| `webrain-integration/CLAUDE.md` | Claude Code 详细操作指南、环境变量大全、bug 模式清单 |
| `webrain-integration/AGENTS.md` | AI 编程助手开发指南（技术栈、目录、命令、测试策略、规范） |
| `webrain-integration/docs/PROJECT_STATE.md` | 项目当前状态与开发轮次历史（唯一权威状态文档） |
| `webrain-integration/protocol/protocol.md` | 主脑↔副脑通信协议（REST + WebSocket，刻意无鉴权） |
| `webrain-integration/vitest.config.ts` | 根 Vitest 配置（`pool: "forks"`，加载两份 setup） |
| `webrain-integration/scripts/verify-install.sh` | 依赖 / venv / node_modules 检查，`--smoke` 跑 E2E 冒烟 |
| `webrain-integration/docker-compose.yml` | Docker 编排（main-brain / sub-brain / frontend / dokobot） |
| `webrain-integration/.env.example` | 环境变量模板 |
| `openclaw-main/Makefile` | 仅含 `build: pnpm build` 一条目标 |
| `openclaw-main/fly.toml` | Fly.io 部署配置（app=openclaw，primary_region=iad，:3000） |
| `openclaw-main/AGENTS.md` / `CLAUDE.md` | OpenClaw 上游 agent 规则（电报体，CI / 测试 / Git 工作流） |
| `webrain-hermes/cli.py` | Hermes 交互式 CLI 入口（prompt_toolkit + Rich，~11k LOC） |
| `webrain-hermes/AGENTS.md` | Hermes 开发指南（项目结构、AIAgent 类、CLI 架构、插件、Skills、测试） |
| `webrain-hermes/WEBRAIN.md` | WeBrain 适配说明 |
| `webrain-hermes/run-webrain.sh` | WeBrain 启动脚本 |

## 五、环境搭建

### 5.1 前置环境要求

- **Node.js 22+**（副脑 + 前端）
- **Python 3.9+**（推荐 3.11，主脑）
- **pnpm**（workspace 模式包管理）
- Docker（可选，用于沙箱功能与 Dokobot CDP 浏览器守护）
- openclaw-main 额外要求：Bun（可选，保持 lock/patches 对齐）
- webrain-hermes 额外要求：uv（Python 包管理，见 uv.lock）、direnv（.envrc 自动加载）

### 5.2 依赖安装步骤

```bash
# 主脑 Python venv（副脑启动时会优先使用此 venv 的 Python 解释器）
cd webrain-integration/sub-brain/main-brain
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cd ../..

# 副脑 + 前端依赖
cd webrain-integration/sub-brain && pnpm install && cd ../..
cd webrain-integration/frontend && pnpm install && cd ../..

# 快速验证依赖、venv、node_modules 是否就绪
./webrain-integration/scripts/verify-install.sh

# 同时跑 e2e smoke 测试（~50s）
./webrain-integration/scripts/verify-install.sh --smoke
```

> vendored 目录（openclaw-main / webrain-hermes / hermes-agent-main）不需要安装依赖，仅供阅读参考。如需独立运行 openclaw-main：`cd openclaw-main && pnpm install`；webrain-hermes：`cd webrain-hermes && uv sync`。

### 5.3 环境变量配置

关键环境变量（完整列表见 `webrain-integration/CLAUDE.md` § Environment variable cheat sheet，含 S1-S19 记忆增强开关）：

| 变量 | 服务 | 默认值 | 说明 |
|------|------|--------|------|
| `WEBRAIN_SUB_BRAIN_PORT` | 副脑 | `3000` | 副脑 HTTP 端口（规范端口，勿用旧值 9797） |
| `WEBRAIN_MAIN_BRAIN_UDS` | 副脑 | `/tmp/webrain-main.sock` | 主脑 UDS 路径（与 PORT 二选一） |
| `WEBRAIN_MAIN_BRAIN_PORT` | 副脑 | `18790` | 强制 TCP 模式连主脑 |
| `WEBRAIN_NO_MAIN_BRAIN` | 副脑 | unset | `1` 时副脑不自动 spawn 主脑 |
| `WEBRAIN_DATA_DIR` | 主脑 | `<repo>/data/main-brain/` | 主脑数据目录（测试请用 `<tmp>`） |
| `WEBRAIN_PYTHON` | 副脑 spawn | auto | 自定义主脑 Python 解释器 |
| `WEBRAIN_API_KEY` | 副脑 | unset | 可选 API Key 鉴权 |
| `WEBRAIN_MCP_TOKEN` | 主脑 | auto 生成至 `~/.webrain/mcp_token` | MCP write tools bearer token |
| `LOG_LEVEL` | 全局 | `info` | 日志级别 |

LLM 端点配置（含明文密钥，**勿 commit**）：

```bash
mkdir -p ~/.webrain
cp webrain-integration/sub-brain/main-brain/config/llm.example.json ~/.webrain/model-config.json
$EDITOR ~/.webrain/model-config.json   # 填入 apiKey，调整 priority（越大越先）
# 重启副脑 或 POST /config/model 热加载
```

## 六、启动与运行

### 6.1 开发模式启动

三终端模式（推荐）：

```bash
# 终端 1：主脑（FastAPI on UDS 默认，或 TCP 若设 WEBRAIN_MAIN_BRAIN_PORT）
cd webrain-integration/sub-brain/main-brain && source venv/bin/activate && python main_brain.py

# 终端 2：副脑（Fastify :3000，会自动 spawn 主脑；若已手动启动主脑，设 WEBRAIN_NO_MAIN_BRAIN=1）
cd webrain-integration/sub-brain && pnpm dev

# 终端 3：前端（Vite HMR :8587，proxy 到 localhost:3000）
cd webrain-integration/frontend && pnpm dev
```

访问 `http://localhost:8587`。

### 6.2 生产构建

```bash
# 前端生产构建（输出 frontend/dist/）
cd webrain-integration/frontend && pnpm build

# 副脑生产构建（tsc 输出 sub-brain/dist/）
cd webrain-integration/sub-brain && pnpm build
```

### 6.3 部署方式

**Docker Compose（推荐）**：

```bash
docker-compose up --build
```

服务编排：
- `main-brain`：Python 多阶段构建，非 root 用户运行，HEALTHCHECK 就绪探针。
- `sub-brain`：Node 22 slim，build 后 `node dist/main.js`。
- `frontend`：Node 22 slim，build 后 `pnpm preview`。
- `dokobot`：CDP 浏览器守护（端口 9222）。

数据卷：
- `./data/sub-brain/main-brain:/data` — 主脑持久化数据
- `./data/sub-brain:/data` — 副脑持久化数据
- `./data/shared:/shared` — 共享数据

PWA：前端注册 Service Worker（`public/sw.js`），支持离线缓存与桌面安装。

## 七、主要接口说明

### 副脑（Sub Brain，:3000）

- `GET /health` — 副脑健康检查
- `GET /brain/health` — 主脑健康检查（经副脑代理）
- `/brain/*` — 主脑接口透传代理（无 allowlist，剥离 `x-forwarded-*`，保留 `Authorization`）
- `/api/skillhub/*` — SkillHub 技能市场（原生 `/api/` 前缀，不剥离）
- `/api/<resource>` — 副脑自有资源（`onRequest` hook strip `/api/` 前缀）
- `GET /metrics` — Prometheus 指标

### 主脑（Main Brain，经副脑代理）

- `POST /config/reload` — 重新拉取 LLM 配置并传播到所有引擎
- `POST /config/model` — 热加载模型配置
- `/mcp/jsonrpc` — MCP 服务端（注意 FastAPI `Any` 参数需用 `Body(...)`）
- chat / reasoning / memory / wiki / kg / planner / canvas / cron 等模块接口

### 通信协议

主脑↔副脑通信协议见 `webrain-integration/protocol/protocol.md`，**刻意无鉴权、CORS 全开、无速率限制**（个人本地部署定位）。

## 八、已知问题与注意事项

- **scope 红线**：`openclaw-main/`、`webrain-hermes/`、`hermes-agent-main/` 为 vendored 上游参考，**严禁编辑 / 重构 / lint / 测试 / 运行 agent**。仅 `webrain-integration/` 可改。
- **端口规范**：副脑规范端口为 **3000**，部分旧文档写 `9797` / `3456` 视为过时，勿重新引入。
- **UDS 旧 socket**：切换 UDS/TCP 模式时，残留的 `/tmp/webrain-main.sock` 会导致启动失败，重启前需清理。
- **LLM 配置闭包陷阱**：任何在 lifespan boot 时闭包捕获 `llm_config` 的引擎，都必须在 `/config/reload` 路径中重建，否则配置热重载失效（已多次出现该 bug 类）。
- **FastAPI 参数映射**：`request: Any` 会被映射为 query 参数而非 body；接收任意 JSON body 须用 `request: Dict[str, Any]` 或 `request: Any = Body(...)`。
- **`asyncio.create_task` 必须保留 Task 引用**（存入 set + `add_done_callback(set.discard)`），否则 CPython GC 可能回收中断。
- **CPU 密集型 ML 推理**（reranker / embedder）必须包在 `loop.run_in_executor(None, ...)` 中；懒加载单例需 `threading.Lock` 双检锁。
- **SQLite 单写锁**：并发 `memory.store` 串行，30 并发约 2.1s/个；如需更高吞吐考虑 WAL 或批量写入。
- **`/brain/*` 代理头剥离**：已剥离 `x-forwarded-*` / `x-real-ip`，但保留 `Authorization`（MCP write-tool 需要 bearer auth）；新增自定义 header 透传需显式加入 `proxy.ts` 白名单。
- **测试规范**：不要给 CI 命令加 `|| true`；冒烟测试用 `WEBRAIN_DATA_DIR=<tmp>` 避免污染开发数据库。
- **文档语言**：项目内文档与注释以简体中文（zh-CN）为主，请保持统一。
- **ESM 全栈**：相对 TS 导入在副脑必须以 `.js` 结尾。

## 九、与其他项目的关系

- **WeBrain 是 ALLProject 体系中的"AI 集成平台核心"**：定位为本地 AI 协作底座，承担推理、记忆、工具执行、知识管理。
- **与 LoveStar / WineryBlog / test 无直接代码依赖**：三者均为独立项目，不引用 WeBrain 的代码或服务。
- **webrain-hermes 与 hermes-agent-main 是同一上游（Hermes Agent）的两份快照**：`webrain-hermes/` 含 WeBrain 适配（`WEBRAIN.md`、`run-webrain.sh`、`webrain.skin.yaml`），`hermes-agent-main/` 为更早期或更纯净的参考副本。
- **openclaw-main 是 OpenClaw 上游参考**：WeBrain 副脑的 plugin-sdk / channel / agent / skill 等设计借鉴 OpenClaw，但**未直接 import**其代码。
- **可被引用的对外能力**：WeBrain 副脑暴露的 HTTP / WebSocket 接口可供其他本地项目作为 AI 后端调用，但因协议无鉴权，**不建议跨网络暴露**。


## 已归档文档索引

- `CLAUDE.md` — CLAUDE.md
- `Gitee上传方法.md` — Gitee 上传方法（全项目统一）
- `PROJECT_INIT.md` — WeBrain · 项目初始化文档
- `设备说明.md` — 集群设备说明（单一真相源）
