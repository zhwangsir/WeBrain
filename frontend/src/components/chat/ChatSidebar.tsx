import { useState } from "react";
import { Button, Popconfirm } from "antd";
import { PlusOutlined, DeleteOutlined, MessageOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { useIsDark } from "../../hooks/useTheme";

interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
}

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

export default function ChatSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: ChatSidebarProps) {
  const isDark = useIsDark();
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);

  const C = {
    cardBg: "var(--c-card)",
    hoverBg: "var(--c-hover)",
    border: "var(--c-border)",
    text: "var(--c-text)",
    text2: "var(--c-text-2)",
    text3: "var(--c-text-3)",
    textInv: "var(--c-text-inv)",
    accent: "var(--c-accent)",
  };

  return (
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
          onClick={onNewSession}
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
                onClick={() => onSelectSession(s.id)}
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
                      onDeleteSession(s.id);
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
  );
}
