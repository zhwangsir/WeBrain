import { useEffect, useRef, useState, useCallback } from "react";
import { Button, Input, Popconfirm, Empty, Tooltip, message, Select } from "antd";
import {
  SendOutlined,
  StopOutlined,
  PlusOutlined,
  DeleteOutlined,
  ClearOutlined,
  ToolOutlined,
  UserOutlined,
  RobotOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  CheckOutlined,
  DownOutlined,
  AudioOutlined,
  AudioMutedOutlined,
  InboxOutlined,
  SearchOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useChatStore } from "../stores/chatStore";
import { useSystemStore } from "../stores/systemStore";
import { useConfigStore } from "../stores/configStore";
import { configApi } from "../api/config";
import { useIsDark } from "../hooks/useTheme";
import MarkdownRenderer from "../components/common/MarkdownRenderer";

export default function ChatPage() {
  const isDark = useIsDark();
  const {
    messages,
    sessions,
    currentSessionId,
    streaming,
    toolEnabled,
    setToolEnabled,
    sendStream,
    stopStream,
    newSession,
    loadHistory,
    deleteSession,
    clearCurrentChat,
    init,
  } = useChatStore();

  const { modelHealth } = useSystemStore();
  const { modelConfig } = useConfigStore();

  const [inputValue, setInputValue] = useState("");
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [msgSearch, setMsgSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const prevMessagesLengthRef = useRef(0);
  const scrollRafRef = useRef<number>(0);
  const isUserScrollRef = useRef(false);

  useEffect(() => {
    init();
  }, [init]);

  // Fetch model health & config on mount
  useEffect(() => {
    const { fetchModelHealth } = useSystemStore.getState();
    const { fetchModelConfig } = useConfigStore.getState();
    fetchModelHealth();
    fetchModelConfig();
  }, []);

  // Smart auto-scroll with separated strategies
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const prevLen = prevMessagesLengthRef.current;
    const currLen = messages.length;
    const grew = currLen > prevLen;
    prevMessagesLengthRef.current = currLen;

    // Calculate distance to bottom
    const distToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distToBottom < 80;

    // Strategy 1: user just sent a message (message count increased while not streaming yet,
    // or the newest message is from user) -> always scroll to bottom
    const lastMsg = messages[messages.length - 1];
    const isUserMessage = lastMsg?.role === "user";

    if (grew && isUserMessage) {
      isUserScrollRef.current = true;
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      setShowScrollBtn(false);
      return;
    }

    // Strategy 2: AI streaming response -> scroll only if user was already near bottom
    if (streaming && nearBottom) {
      container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
      setShowScrollBtn(false);
      return;
    }

    // Strategy 3: non-streaming updates (e.g. history load, message complete)
    // Keep position unless user is near bottom
    if (nearBottom) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      setShowScrollBtn(false);
    } else if (grew) {
      setShowScrollBtn(true);
    }
  }, [messages, streaming]);

  const handleScroll = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const container = messagesContainerRef.current;
      if (!container) return;
      const threshold = 80;
      const distToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const nearBottom = distToBottom < threshold;
      setShowScrollBtn(!nearBottom);
    });
  }, []);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
    setShowScrollBtn(false);

  };

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || streaming) return;
    setInputValue("");
    sendStream(text);
  }, [inputValue, streaming, sendStream]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Voice input
  const toggleVoiceInput = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      message.error("您的浏览器不支持语音输入");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setInputValue((prev) => prev + finalTranscript);
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
      message.error("语音识别失败");
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    setIsRecording(true);
  }, [isRecording]);

  // Drag and drop file upload
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // For now, read text files and append content to input
    // TODO: upload binary files to server
    files.forEach((file) => {
      if (file.type.startsWith("text/") || file.name.endsWith(".md") || file.name.endsWith(".json")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          setInputValue((prev) => prev + (prev ? "\n\n" : "") + `\`\`\`${file.name}\n${content}\n\`\`\``);
        };
        reader.readAsText(file);
      } else {
        message.info(`文件 "${file.name}" 已收到（${(file.size / 1024).toFixed(1)} KB），暂不支持此格式解析`);
      }
    });
  };

  const activeSession = sessions.find((s) => s.id === currentSessionId);

  const filteredMessages = msgSearch.trim()
    ? messages.filter((m) => m.content.toLowerCase().includes(msgSearch.toLowerCase()))
    : messages;

  const handleExport = () => {
    const title = activeSession?.title || "chat";
    const md = messages
      .map((m) => {
        const role = m.role === "user" ? "👤 User" : "🤖 Assistant";
        const time = m.timestamp ? new Date(m.timestamp).toLocaleString("zh-CN") : "";
        return `## ${role} · ${time}\n\n${m.content}\n`;
      })
      .join("\n---\n\n");
    const blob = new Blob([`# ${title}\n\n${md}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    message.success("对话已导出");
  };

  const C = {
    pageBg: "var(--c-page)",
    cardBg: "var(--c-card)",
    hoverBg: "var(--c-hover)",
    border: "var(--c-border)",
    text: "var(--c-text)",
    text2: "var(--c-text-2)",
    text3: "var(--c-text-3)",
    textInv: "var(--c-text-inv)",
    success: "var(--c-success)",
    error: "var(--c-error)",
    accent: "var(--c-accent)",
    userBubbleBg: isDark ? "#f5f5f5" : "#000000",
    userBubbleText: isDark ? "#0a0a0a" : "#ffffff",
    assistantBubbleBg: isDark ? "#1f1f1f" : "#f5f5f5",
    assistantBubbleText: isDark ? "#f5f5f5" : "#000000",
    assistantBubbleBorder: isDark ? "#27272a" : "#e5e5e5",
  };

  return (
    <div
      className="chat-page-root"
      style={{
        display: "flex",
        height: "calc(100vh - 64px)",
        background: C.pageBg,
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* ═══ Sidebar ═══ */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: `1px solid ${C.border}`,
          background: C.cardBg,
        }}
      >
        <div style={{ padding: "20px 16px 16px", borderBottom: `1px solid ${C.border}` }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            对话历史
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            onClick={() => {
              newSession();
              setInputValue("");
            }}
            style={{
              height: 36,
              borderRadius: 6,
              background: C.accent,
              border: "none",
              fontWeight: 500,
              fontSize: 13,
              color: C.textInv,
            }}
          >
            新对话
          </Button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "8px 0" }}>
          {sessions.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <MessageOutlined style={{ fontSize: 24, color: C.text3 }} />
              <p style={{ color: C.text3, fontSize: 13, marginTop: 12 }}>暂无历史对话</p>
            </div>
          ) : (
            sessions.map((s) => {
              const isActive = s.id === currentSessionId;
              return (
                <div
                  key={s.id}
                  onMouseEnter={() => setHoveredSession(s.id)}
                  onMouseLeave={() => setHoveredSession(null)}
                  onClick={() => {
                    loadHistory(s.id);
                    setInputValue("");
                  }}
                  style={{
                    margin: "0 8px 2px",
                    padding: "10px 12px",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: isActive ? C.accent : "transparent",
                    transition: "background 120ms ease",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: isActive ? 500 : 400,
                        color: isActive ? C.textInv : C.text,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        lineHeight: 1.4,
                      }}
                    >
                      {s.title || "新对话"}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: isActive ? (isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)") : C.text3,
                        marginTop: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <ClockCircleOutlined style={{ fontSize: 10 }} />
                      {formatTime(s.updatedAt)}
                    </div>
                  </div>
                  {(hoveredSession === s.id || isActive) && (
                    <Popconfirm
                      title="删除会话"
                      description="确定要删除这条对话记录吗？"
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        deleteSession(s.id);
                      }}
                      onCancel={(e) => e?.stopPropagation()}
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true, size: "small" }}
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          color: isActive ? (isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.6)") : C.text3,
                          padding: "0 4px",
                          minWidth: 24,
                          height: 24,
                        }}
                      />
                    </Popconfirm>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══ Chat Area ═══ */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: C.pageBg,
          minWidth: 0,
          overflow: "hidden",
          position: "relative",
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {dragOver && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 20,
              background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
              border: `2px dashed ${C.accent}`,
              borderRadius: 8,
              margin: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 12,
              backdropFilter: "blur(4px)",
            }}
          >
            <InboxOutlined style={{ fontSize: 48, color: C.accent }} />
            <span style={{ fontSize: 16, fontWeight: 500, color: C.text }}>松开以上传文件</span>
            <span style={{ fontSize: 13, color: C.text3 }}>支持 .txt, .md, .json 等文本文件</span>
          </div>
        )}

        {/* Chat Header */}
        <div
          style={{
            height: 52,
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {streaming && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: C.success,
                  display: "inline-block",
                  animation: "chatPulse 1.5s ease-in-out infinite",
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: C.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {activeSession?.title || "新对话"}
            </span>
            {streaming && <span style={{ fontSize: 12, color: C.success, fontWeight: 400 }}>生成中…</span>}
          </div>

          {/* Model selector */}
          {modelHealth && modelHealth.endpoints && Object.keys(modelHealth.endpoints).length > 0 && (
            <div style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0, padding: "0 16px" }}>
              <Select
                size="small"
                variant="borderless"
                popupMatchSelectWidth={false}
                style={{ minWidth: 140, color: C.text2 }}
                value={modelConfig?.modelId || ""}
                onSelect={async (value: string) => {
                  const ep = Object.entries(modelHealth.endpoints as Record<string, any>).find(
                    ([, v]) => v.model_id === value
                  );
                  if (ep) {
                    const [, info] = ep;
                    try {
                      await configApi.setModel({ baseUrl: info.base_url, modelId: info.model_id });
                      message.success(`已切换模型: ${info.model_id}`);
                      useConfigStore.getState().fetchModelConfig?.();
                    } catch (e: any) {
                      message.error(e.message || "切换模型失败");
                    }
                  }
                }}
                options={Object.entries(modelHealth.endpoints as Record<string, any>).map(([name, info]) => ({
                  label: (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: info.healthy ? C.success : C.error,
                          display: "inline-block",
                        }}
                      />
                      <span>{info.model_id}</span>
                      <span style={{ fontSize: 11, color: C.text3, marginLeft: 4 }}>{name}</span>
                    </div>
                  ),
                  value: info.model_id,
                }))}
              />
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {messages.length > 0 && (
              <>
                <Tooltip title="搜索消息">
                  <Button
                    type="text"
                    size="small"
                    icon={<SearchOutlined />}
                    onClick={() => setShowSearch((v) => !v)}
                    style={{ color: showSearch ? C.accent : C.text3, height: 28, padding: "0 8px" }}
                  />
                </Tooltip>
                <Tooltip title="导出对话">
                  <Button
                    type="text"
                    size="small"
                    icon={<FileTextOutlined />}
                    onClick={handleExport}
                    style={{ color: C.text3, height: 28, padding: "0 8px" }}
                  />
                </Tooltip>
              </>
            )}
            <Tooltip title={toolEnabled ? "工具调用已开启" : "工具调用已关闭"}>
              <Button
                type="text"
                size="small"
                icon={<ToolOutlined />}
                onClick={() => setToolEnabled(!toolEnabled)}
                style={{ color: toolEnabled ? C.success : C.text3, fontSize: 13, height: 28, padding: "0 8px" }}
              >
                {toolEnabled ? "ON" : "OFF"}
              </Button>
            </Tooltip>
            {messages.length > 0 && (
              <Popconfirm
                title="清空对话"
                description="清空当前对话内容？"
                onConfirm={() => clearCurrentChat()}
                okText="清空"
                cancelText="取消"
                okButtonProps={{ danger: true, size: "small" }}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<ClearOutlined />}
                  style={{ color: C.text3, height: 28, padding: "0 8px" }}
                >
                  清空
                </Button>
              </Popconfirm>
            )}
          </div>
        </div>

        {/* Message search bar */}
        {showSearch && (
          <div style={{ padding: "12px 32px 0", flexShrink: 0 }}>
            <Input
              placeholder="搜索消息内容..."
              value={msgSearch}
              onChange={(e) => setMsgSearch(e.target.value)}
              prefix={<SearchOutlined style={{ color: "var(--c-text-3)" }} />}
              allowClear
              autoFocus
              style={{ maxWidth: 400 }}
            />
            {msgSearch && (
              <span style={{ fontSize: 12, color: "var(--c-text-3)", marginLeft: 8 }}>
                {filteredMessages.length} / {messages.length} 条消息
              </span>
            )}
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="chat-scroll-container"
          style={{ flex: 1, overflow: "auto", padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20, minHeight: 0 }}
        >
          {filteredMessages.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ color: C.text3, fontSize: 14, fontWeight: 300 }}>
                    输入消息开始对话，或拖拽文件到此处
                  </span>
                }
              />
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} isDark={isDark} highlight={msgSearch} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll-to-bottom button */}
        <Button
          type="primary"
          shape="circle"
          size="small"
          icon={<DownOutlined />}
          onClick={scrollToBottom}
          className="chat-scroll-btn"
          style={{
            position: "absolute",
            right: 32,
            bottom: 120,
            zIndex: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            background: C.accent,
            borderColor: C.accent,
            color: C.textInv,
            opacity: showScrollBtn ? 1 : 0,
            transform: showScrollBtn ? "translateY(0)" : "translateY(8px)",
            pointerEvents: showScrollBtn ? "auto" : "none",
            transition: "opacity 250ms ease, transform 250ms ease",
          }}
        />

        {/* Input */}
        <div
          style={{ borderTop: `1px solid ${C.border}`, padding: "16px 32px 24px", flexShrink: 0, background: C.pageBg }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, maxWidth: 800, margin: "0 auto" }}>
            {/* Voice input button */}
            <Tooltip title={isRecording ? "停止录音" : "语音输入"}>
              <Button
                type="text"
                onClick={toggleVoiceInput}
                style={{
                  height: 44,
                  width: 36,
                  borderRadius: 8,
                  color: isRecording ? C.error : C.text3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  flexShrink: 0,
                  animation: isRecording ? "pulse 1.5s infinite" : undefined,
                }}
                icon={
                  isRecording ? (
                    <AudioOutlined style={{ fontSize: 16 }} />
                  ) : (
                    <AudioMutedOutlined style={{ fontSize: 16 }} />
                  )
                }
              />
            </Tooltip>

            <div style={{ flex: 1, position: "relative" }}>
              <Input.TextArea
                ref={textareaRef}
                placeholder="输入消息…"
                autoSize={{ minRows: 1, maxRows: 6 }}
                disabled={streaming}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  borderRadius: 8,
                  padding: "12px 16px",
                  paddingRight: 44,
                  background: C.hoverBg,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                  fontSize: 14,
                  lineHeight: 1.6,
                  resize: "none",
                  transition: "border-color 150ms ease, background 150ms ease",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = C.accent;
                  e.target.style.background = C.pageBg;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = C.border;
                  e.target.style.background = C.hoverBg;
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: 8,
                  bottom: 8,
                  fontSize: 11,
                  color: C.text3,
                  pointerEvents: "none",
                }}
              >
                ↵
              </div>
            </div>
            {streaming ? (
              <Button
                onClick={stopStream}
                style={{
                  height: 44,
                  width: 44,
                  borderRadius: 8,
                  background: C.error,
                  border: "none",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  flexShrink: 0,
                }}
                icon={<StopOutlined style={{ fontSize: 16 }} />}
              />
            ) : (
              <Button
                type="primary"
                style={{
                  height: 44,
                  width: 44,
                  borderRadius: 8,
                  background: inputValue.trim() ? C.accent : C.hoverBg,
                  border: inputValue.trim() ? "none" : `1px solid ${C.border}`,
                  color: inputValue.trim() ? C.textInv : C.text3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  flexShrink: 0,
                  transition: "background 150ms ease, color 150ms ease",
                }}
                icon={<SendOutlined style={{ fontSize: 16 }} />}
                onClick={handleSend}
                disabled={!inputValue.trim()}
              />
            )}
          </div>
          <div
            style={{
              textAlign: "center",
              marginTop: 6,
              fontSize: 11,
              color: C.text3,
              maxWidth: 800,
              margin: "6px auto 0",
            }}
          >
            Shift + Enter 换行 · Enter 发送 · 拖拽文件上传
          </div>
        </div>
      </div>

      <style>{`
        @keyframes chatPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .chat-page-root {
          margin: -48px;
          width: calc(100% + 96px);
        }
        @media (max-width: 768px) {
          .chat-page-root {
            margin: -24px;
            width: calc(100% + 48px);
          }
        }
        .chat-scroll-container::-webkit-scrollbar {
          width: 5px;
        }
        .chat-scroll-container::-webkit-scrollbar-track {
          background: transparent;
        }
        .chat-scroll-container::-webkit-scrollbar-thumb {
          background: ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"};
          border-radius: 10px;
        }
        .chat-scroll-container::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)"};
        }
        .chat-scroll-container {
          scrollbar-width: thin;
          scrollbar-color: ${isDark ? "rgba(255,255,255,0.12) transparent" : "rgba(0,0,0,0.12) transparent"};
        }
        .chat-markdown pre, .chat-markdown code, .chat-markdown table {
          max-width: 100%;
        }
        .chat-markdown pre > div {
          overflow-x: auto !important;
        }
      `}</style>
    </div>
  );
}

/* ─── Highlighted Text ─── */
function HighlightedText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark
            key={i}
            style={{
              background: "rgba(22, 163, 74, 0.25)",
              color: "inherit",
              borderRadius: 3,
              padding: "0 2px",
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/* ─── Message Bubble ─── */
function MessageBubble({ msg, isDark, highlight }: { msg: any; isDark: boolean; highlight?: string }) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error("复制失败");
    }
  };

  const bubbleBg = isUser
    ? isDark
      ? "#f5f5f5"
      : "#000000"
    : isSystem
      ? isDark
        ? "#27272a"
        : "#f0f0f0"
      : isDark
        ? "#1f1f1f"
        : "#f5f5f5";

  const bubbleText = isUser ? (isDark ? "#0a0a0a" : "#ffffff") : isDark ? "#f5f5f5" : "#000000";

  const bubbleBorder = isUser
    ? "none"
    : isSystem
      ? isDark
        ? "1px dashed #3f3f46"
        : "1px dashed #cccccc"
      : isDark
        ? "1px solid #27272a"
        : "1px solid #e5e5e5";

  const avatarBg = isUser ? (isDark ? "#f5f5f5" : "#000000") : isSystem ? "#666666" : isDark ? "#27272a" : "#f5f5f5";

  const avatarIconColor = isUser
    ? isDark
      ? "#0a0a0a"
      : "#ffffff"
    : isSystem
      ? "#ffffff"
      : isDark
        ? "#a1a1aa"
        : "#666666";

  const timeStr = msg.timestamp
    ? new Date(msg.timestamp).toLocaleString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div style={{ display: "flex", gap: 12, flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-start", minWidth: 0, maxWidth: "100%" }}>
      {/* Avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: avatarBg,
          border: isUser ? "none" : isDark ? "1px solid #27272a" : "1px solid #e5e5e5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {isUser ? (
          <UserOutlined style={{ fontSize: 12, color: avatarIconColor }} />
        ) : isSystem ? (
          <RobotOutlined style={{ fontSize: 12, color: avatarIconColor }} />
        ) : (
          <RobotOutlined style={{ fontSize: 12, color: avatarIconColor }} />
        )}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: "min(720px, 85%)", display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            padding: "12px 16px",
            borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            background: bubbleBg,
            border: bubbleBorder,
            color: bubbleText,
            fontSize: 14,
            lineHeight: 1.7,
            wordBreak: "break-word",
            position: "relative",
          }}
        >
          {/* User messages: plain text with optional highlight; Assistant: Markdown */}
          {isUser ? (
            <div style={{ whiteSpace: "pre-wrap" }}>
              {highlight ? <HighlightedText text={msg.content} highlight={highlight} /> : msg.content}
            </div>
          ) : (
            <div className="chat-markdown">
              <MarkdownRenderer content={msg.content || ""} />
            </div>
          )}

          {msg.isStreaming && (
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: 16,
                background: "var(--c-success)",
                marginLeft: 4,
                verticalAlign: "middle",
                animation: "chatPulse 1s infinite",
              }}
            />
          )}

          {/* Tool calls */}
          {msg.toolCalls && msg.toolCalls.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {msg.toolCalls.map((tc: any, i: number) => (
                <span
                  key={i}
                  style={{
                    fontSize: 11,
                    color: isDark ? "#a1a1aa" : "#666666",
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                    border: isDark ? "1px solid #27272a" : "1px solid #e5e5e5",
                    borderRadius: 4,
                    padding: "2px 8px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <ToolOutlined style={{ fontSize: 10 }} />
                  {tc.function?.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Meta row: timestamp + copy */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: isUser ? "flex-end" : "flex-start",
            padding: "0 4px",
          }}
        >
          {timeStr && (
            <span style={{ fontSize: 11, color: isDark ? "#52525b" : "#a3a3a3", fontWeight: 300 }}>{timeStr}</span>
          )}
          {!msg.isStreaming && msg.content && (
            <Tooltip title={copied ? "已复制" : "复制"}>
              <button
                onClick={handleCopy}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 2,
                  display: "flex",
                  alignItems: "center",
                  color: copied ? "var(--c-success)" : isDark ? "#52525b" : "#a3a3a3",
                  fontSize: 12,
                  transition: "color 150ms",
                }}
              >
                {copied ? <CheckOutlined /> : <CopyOutlined />}
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Time formatter ─── */
function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "昨天";
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}
