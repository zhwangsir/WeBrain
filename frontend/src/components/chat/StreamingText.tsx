import { useMemo } from "react";

interface StreamingTextProps {
  content: string;
  isDark: boolean;
}

/**
 * Lightweight text renderer for streaming output.
 * Shows plain text with line breaks preserved, no full Markdown re-parsing.
 * Switches to MarkdownRenderer after streaming completes.
 */
export default function StreamingText({ content, isDark }: StreamingTextProps) {
  const lines = useMemo(() => content.split("\n"), [content]);

  return (
    <div style={{ lineHeight: 1.7, fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {lines.map((line, i) => {
        // Code block indicator lines
        if (line.startsWith("```")) {
          return (
            <div
              key={i}
              style={{
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                padding: "2px 8px",
                borderRadius: 4,
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 12,
                color: isDark ? "#a1a1aa" : "#666666",
                margin: "2px 0",
              }}
            >
              {line}
            </div>
          );
        }
        // Inline code
        if (line.includes("`")) {
          const parts = line.split(/(`[^`]+`)/g);
          return (
            <div key={i}>
              {parts.map((part, j) =>
                part.startsWith("`") && part.endsWith("`") ? (
                  <code
                    key={j}
                    style={{
                      background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                      padding: "1px 4px",
                      borderRadius: 3,
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: "0.9em",
                    }}
                  >
                    {part.slice(1, -1)}
                  </code>
                ) : (
                  <span key={j}>{part}</span>
                )
              )}
            </div>
          );
        }
        return <div key={i}>{line || " "}</div>;
      })}
    </div>
  );
}
