export default function HighlightedText({ text, highlight }: { text: string; highlight: string }) {
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
