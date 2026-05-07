interface PageShellProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
}

export function PageShell({ title, subtitle, icon, actions, children, loading }: PageShellProps) {
  return (
    <div style={{ maxWidth: 1440, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 32,
          minHeight: 48,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            {icon && (
              <span style={{ fontSize: 22, color: "var(--c-accent)", lineHeight: 1, display: "flex" }}>{icon}</span>
            )}
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                color: "var(--c-text)",
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
                fontFamily: '"Inter", sans-serif',
              }}
            >
              {title}
            </h1>
          </div>
          {subtitle && (
            <p
              style={{
                margin: 0,
                color: "var(--c-text-2)",
                fontSize: 14,
                fontWeight: 300,
                lineHeight: 1.5,
                fontFamily: '"Inter", sans-serif',
                paddingLeft: icon ? 34 : 0,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div style={{ display: "flex", gap: 12, flexShrink: 0, paddingTop: 2 }}>{actions}</div>}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: "80px 0", textAlign: "center" }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: "2px solid var(--c-border)",
              borderTopColor: "var(--c-accent)",
              borderRadius: "50%",
              animation: "spin 800ms linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ color: "var(--c-text-3)", fontSize: 13, fontWeight: 300, margin: 0 }}>加载中...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
