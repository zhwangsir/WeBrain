interface LoadingProps {
  tip?: string;
  fullScreen?: boolean;
}

export function Loading({ tip = "加载中...", fullScreen }: LoadingProps) {
  const content = (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: 28,
          height: 28,
          border: "2px solid var(--c-border)",
          borderTopColor: "var(--c-accent)",
          borderRadius: "50%",
          animation: "spin 700ms linear infinite",
          margin: "0 auto 12px",
        }}
      />
      <p
        style={{
          margin: 0,
          color: "var(--c-text-3)",
          fontSize: 13,
          fontWeight: 300,
          fontFamily: '"Inter", sans-serif',
        }}
      >
        {tip}
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (fullScreen) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--c-page)",
        }}
      >
        {content}
      </div>
    );
  }

  return <div style={{ padding: "80px 0" }}>{content}</div>;
}
