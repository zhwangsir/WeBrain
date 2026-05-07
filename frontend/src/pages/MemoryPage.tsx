import { useState, useEffect } from "react";
import { Input, Empty, Skeleton } from "antd";
import { HistoryOutlined } from "@ant-design/icons";
import { PageShell } from "../components/common/PageShell";
import { useMemoryStore } from "../stores/memoryStore";
import { useDebounce } from "../hooks/useDebounce";

export default function MemoryPage() {
  const { memories, search, fetchMemories, loading } = useMemoryStore();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 400);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  useEffect(() => {
    if (debouncedQ.trim()) {
      search(debouncedQ);
    } else {
      fetchMemories();
    }
  }, [debouncedQ, search, fetchMemories]);

  return (
    <PageShell
      title="记忆"
      subtitle="搜索与管理分层记忆"
      icon={<HistoryOutlined />}
      loading={loading && memories.length === 0}
    >
      <Input.Search
        placeholder="搜索记忆..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        loading={loading && !!q}
        style={{ maxWidth: 480, marginBottom: 32 }}
        allowClear
      />

      {loading && memories.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: 24,
                borderRadius: 12,
                border: "1px solid var(--c-border)",
                background: "var(--c-card)",
              }}
            >
              <Skeleton active paragraph={{ rows: 2 }} title={false} />
            </div>
          ))}
        </div>
      ) : memories.length === 0 ? (
        <Empty
          description={
            <span style={{ color: "var(--c-text-3)", fontSize: 14, fontWeight: 300 }}>
              {q ? "无搜索结果" : "暂无记忆"}
            </span>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {memories.map((m) => (
            <div
              key={m.id}
              style={{
                padding: 24,
                borderRadius: 12,
                border: "1px solid var(--c-border)",
                background: "var(--c-card)",
                boxShadow: "var(--shadow)",
                transition: "box-shadow 200ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow)";
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 300,
                  color: "var(--c-text-3)",
                  marginBottom: 6,
                  letterSpacing: "0.3px",
                }}
              >
                [{m.level}] {m.source}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 400,
                  color: "var(--c-text)",
                  lineHeight: 1.7,
                  fontFamily: '"Inter", sans-serif',
                }}
              >
                {m.content}
              </div>
              {m.vectorScore !== undefined && (
                <div style={{ fontSize: 12, fontWeight: 300, color: "var(--c-accent)", marginTop: 8 }}>
                  相似度: {(m.vectorScore * 100).toFixed(1)}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
