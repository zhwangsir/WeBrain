import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";

interface EmptyStateProps {
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({ description, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <div style={{ textAlign: "center", padding: "80px 0" }}>
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: "var(--c-hover)",
          border: "1px solid var(--c-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
        }}
      >
        {icon || (
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--c-text-3)"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        )}
      </div>
      <p
        style={{
          margin: "0 0 24px",
          color: "var(--c-text-2)",
          fontSize: 15,
          fontWeight: 400,
          lineHeight: 1.6,
          fontFamily: '"Inter", sans-serif',
        }}
      >
        {description}
      </p>
      {actionLabel && onAction && (
        <Button type="primary" icon={<PlusOutlined />} onClick={onAction} style={{ height: 40, fontWeight: 600 }}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
