# WeBrain 主脑-副脑通信协议

## 概述

主脑 ↔ 副脑之间的标准化通信协议。

## 传输层

- **HTTP REST API**: 请求-响应模式
- **WebSocket**: 实时双向通信
- **数据格式**: JSON

## 零安全限制

- 无认证/鉴权
- 无 CORS 限制
- 无速率限制
- 所有接口公开可访问

## 主脑 → 副脑 接口

### 工具执行
```
POST /tools/execute
{
  "tool": "shell",
  "params": { "command": "ls -la" }
}

Response:
{
  "ok": true,
  "result": { "output": "..." }
}
```

### 消息发送
```
POST /channels/send
{
  "channel": "telegram",
  "recipient": "@user",
  "content": "Hello"
}
```

### 浏览器操作
```
POST /dokobot/browse
{
  "url": "https://example.com",
  "action": "read"
}
```

## 副脑 → 主脑 接口

### 记忆存储
```
POST /memory/store
{
  "level": "L1",
  "content": "User asked about weather",
  "session_id": "sess-123"
}
```

### 推理分析
```
POST /reasoning/analyze
{
  "problem": "How to optimize database queries",
  "context": { "db_type": "sqlite" }
}
```

### 决策规划
```
POST /decision/plan
{
  "task": "Deploy application",
  "constraints": { "budget": 100 }
}
```

## WebSocket 消息格式

```json
{
  "action": "tool.execute",
  "request_id": "req-123",
  "data": {
    "tool": "shell",
    "params": { "command": "date" }
  }
}

{
  "action": "tool.result",
  "request_id": "req-123",
  "data": { "output": "Mon Jan 1 00:00:00 UTC 2026" }
}
```

## 错误处理

```json
{
  "ok": false,
  "error": "Tool not found: unknown_tool",
  "code": "TOOL_NOT_FOUND"
}
```

## 状态同步

主脑每 30 秒向副脑发送心跳:
```json
{ "action": "heartbeat", "timestamp": 1234567890 }
```

副脑回复:
```json
{ "action": "heartbeat.ack", "status": "ok" }
```
