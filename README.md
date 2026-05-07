# WeBrain Integration Platform

**主脑 (Hermes)** + **副脑 (OpenClaw)** + **Dokobot** 深度集成平台

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (port 3000)                      │
│              React 18 + Vite + Ant Design 5                  │
│           PWA · Keyboard Shortcuts · Dark Mode               │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                 Sub Brain: OpenClaw (3000)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Tools   │ │ Channels │ │  Plugins │ │ Ecosystem│       │
│  │  16+     │ │  30+     │ │  130+    │ │  Sharing │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Browser │ │  Agent   │ │  Memory  │ │   CLI    │       │
│  │Automation│ │ Manager  │ │  Proxy   │ │          │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                          ↕ /brain/* Proxy                    │
└─────────────────────────┬───────────────────────────────────┘
                          │ UDS /tmp/webrain-main.sock
┌─────────────────────────┴───────────────────────────────────┐
│                 Main Brain: Hermes (UDS/TCP)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Memory  │ │ Reasoning│ │ Evolution│ │ Decision │       │
│  │  L1-L4   │ │  Engine  │ │  Engine  │ │  Center  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                     │
│  │   Chat   │ │   Wiki   │ │Knowledge │                     │
│  │  Engine  │ │  Notes   │ │  Graph   │                     │
│  └──────────┘ └──────────┘ └──────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## 端口

| 服务 | 端口 | 说明 |
|------|------|------|
| Sub Brain + Frontend | `3000` | 统一入口，静态文件 + API + Brain 代理 |
| Frontend Dev Server | `8587` | Vite dev server（开发时使用） |
| Main Brain | UDS `/tmp/webrain-main.sock` | Unix Domain Socket（零 TCP 暴露） |
| Main Brain (fallback) | `18790` | TCP 回退（UDS 禁用时） |
| Prometheus Metrics | `3000/metrics` | process_cpu、memory、http_requests_total |

## 启动

### 本地开发

```bash
# 1. 启动 Sub Brain（自动启动 Main Brain）
cd sub-brain && pnpm dev

# 2. 启动前端开发服务器（另一个终端）
cd frontend && pnpm dev

# 3. 访问
open http://localhost:3000        # 生产构建
open http://localhost:8587        # Vite 开发服务器
```

### Docker

```bash
docker-compose up --build
```

### 测试

```bash
# 全部测试（需要服务运行在 3000 端口）
pnpm test

# Sub Brain 独立测试
cd sub-brain && pnpm test

# 前端测试
cd frontend && pnpm test
```

## 特性

- **Bundle 分割**: 5 个 chunk（react-core、antd、motion、state、index），无循环依赖
- **UDS 通信**: Main Brain 通过 Unix Socket 与 Sub Brain 通信
- **Trace ID**: 全链路追踪，`x-trace-id` 贯穿 Sub Brain → Main Brain
- **Prometheus 指标**: `/metrics` 端点暴露进程和 HTTP 指标
- **PWA**: manifest.json + Service Worker 离线缓存
- **键盘快捷键**: `Cmd/Ctrl+K` 命令面板，`Cmd/Ctrl+/` 快捷键帮助
- **懒加载**: 10 个页面全部 React.lazy 按需加载
- **零安全限制**: CORS origin:true，无 JWT，无鉴权

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18, Vite, Ant Design 5, Tailwind, Framer Motion, Zustand |
| Sub Brain | Fastify, Playwright, TypeScript, ESM |
| Main Brain | Python, FastAPI, Uvicorn |
| 测试 | Vitest, jsdom, @testing-library/react |
