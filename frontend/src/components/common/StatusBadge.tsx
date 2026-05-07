/**
 * StatusBadge — Accessible status indicator
 * Green for active/success, red for error/failure, gray for neutral.
 * Shape + color + text combined for accessibility.
 */

const statusMap: Record<string, { text: string; variant: "success" | "error" | "neutral" }> = {
  ok: { text: "正常", variant: "success" },
  healthy: { text: "健康", variant: "success" },
  connected: { text: "已连接", variant: "success" },
  running: { text: "运行中", variant: "success" },
  enabled: { text: "已启用", variant: "success" },
  completed: { text: "已完成", variant: "success" },
  success: { text: "成功", variant: "success" },

  error: { text: "错误", variant: "error" },
  failed: { text: "失败", variant: "error" },
  down: { text: "离线", variant: "error" },

  degraded: { text: "降级", variant: "neutral" },
  disconnected: { text: "未连接", variant: "neutral" },
  disabled: { text: "已禁用", variant: "neutral" },
  pending: { text: "待处理", variant: "neutral" },
};

const variantStyles = {
  success: {
    color: "var(--c-success)",
    bg: "var(--c-success)",
    border: "none",
    weight: 500,
  },
  error: {
    color: "var(--c-error)",
    bg: "var(--c-error)",
    border: "none",
    weight: 500,
  },
  neutral: {
    color: "var(--c-text-3)",
    bg: "transparent",
    border: "1.5px solid var(--c-text-3)",
    weight: 400,
  },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const s = statusMap[status] || { text: status, variant: "neutral" as const };
  const style = variantStyles[s.variant];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        fontWeight: style.weight,
        color: style.color,
        fontFamily: '"Inter", sans-serif',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: style.bg,
          border: style.border,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      {s.text}
    </span>
  );
}
