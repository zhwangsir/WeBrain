import { useState, useEffect, useMemo } from "react";
import { Input, Button, List, Tag, Empty, Spin, Card, Statistic, Row, Col } from "antd";
import { ShareAltOutlined, DatabaseOutlined, NodeIndexOutlined, ApartmentOutlined } from "@ant-design/icons";
import { PageShell } from "../components/common/PageShell";
import { useKgStore } from "../stores/kgStore";

const typeColors: Record<string, string> = {
  concept: "var(--c-text)",
  person: "var(--c-text-2)",
  organization: "var(--c-text-2)",
  location: "var(--c-text-2)",
  event: "var(--c-text-2)",
  unknown: "var(--c-text-3)",
};

export default function KnowledgeGraphPage() {
  const { entities, selectedEntity, entityRelations, stats, loading, fetchEntities, selectEntity, search, fetchStats } =
    useKgStore();

  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");

  useEffect(() => {
    fetchEntities();
    fetchStats();
  }, [fetchEntities, fetchStats]);

  const filtered = useMemo(() => {
    return selectedType ? entities.filter((e) => e.type === selectedType) : entities;
  }, [entities, selectedType]);

  const types = useMemo(() => {
    const set = new Set(entities.map((e) => e.type));
    return Array.from(set);
  }, [entities]);

  const handleSearch = (v: string) => {
    setQuery(v);
    if (v.trim()) search(v);
  };

  return (
    <PageShell title="知识图谱" subtitle="实体关系可视化与管理" icon={<ShareAltOutlined />}>
      {/* Stats */}
      <Row gutter={[24, 24]} style={{ marginBottom: 48 }}>
        <Col xs={12} md={6}>
          <Card
            style={{ borderRadius: 12, border: "1px solid var(--c-border)", boxShadow: "var(--shadow)" }}
            bodyStyle={{ padding: 32 }}
          >
            <Statistic
              title="实体数"
              value={stats?.entity_count || entities.length}
              prefix={<DatabaseOutlined style={{ color: "var(--c-text-2)" }} />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card
            style={{ borderRadius: 12, border: "1px solid var(--c-border)", boxShadow: "var(--shadow)" }}
            bodyStyle={{ padding: 32 }}
          >
            <Statistic
              title="关系数"
              value={stats?.relation_count || 0}
              prefix={<NodeIndexOutlined style={{ color: "var(--c-text-2)" }} />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card
            style={{ borderRadius: 12, border: "1px solid var(--c-border)", boxShadow: "var(--shadow)" }}
            bodyStyle={{ padding: 32 }}
          >
            <Statistic
              title="实体类型"
              value={types.length}
              prefix={<ApartmentOutlined style={{ color: "var(--c-text-2)" }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
        <Input.Search
          placeholder="搜索实体..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ width: 320 }}
          allowClear
        />
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            size="small"
            type={selectedType === "" ? "primary" : "default"}
            onClick={() => setSelectedType("")}
            style={{ height: 32, fontWeight: selectedType === "" ? 600 : 400 }}
          >
            全部
          </Button>
          {types.map((t) => (
            <Button
              key={t}
              size="small"
              type={selectedType === t ? "primary" : "default"}
              onClick={() => setSelectedType(t)}
              style={{ height: 32, fontWeight: selectedType === t ? 600 : 400 }}
            >
              {t}
            </Button>
          ))}
        </div>
      </div>

      {/* Selected entity detail */}
      {selectedEntity && (
        <Card
          style={{
            marginBottom: 32,
            borderRadius: 12,
            border: "1px solid var(--c-border)",
            boxShadow: "var(--shadow)",
          }}
          bodyStyle={{ padding: 32 }}
        >
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <Tag
                style={{
                  background: "var(--c-hover)",
                  border: "1px solid var(--c-border)",
                  color: typeColors[selectedEntity.type] || "var(--c-text-2)",
                  fontSize: 12,
                  fontWeight: 300,
                  borderRadius: 8,
                }}
              >
                {selectedEntity.type}
              </Tag>
              <div
                style={{
                  marginTop: 10,
                  color: "var(--c-text-2)",
                  fontSize: 14,
                  fontWeight: 300,
                  lineHeight: 1.6,
                  maxWidth: 400,
                }}
              >
                {selectedEntity.description || "无描述"}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: "var(--c-text)" }}>关系</div>
              {entityRelations.length === 0 ? (
                <div style={{ color: "var(--c-text-3)", fontSize: 13, fontWeight: 300 }}>无关系</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {entityRelations.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        fontSize: 13,
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "var(--c-hover)",
                        border: "1px solid var(--c-border)",
                      }}
                    >
                      <Tag
                        style={{
                          fontSize: 11,
                          background: "transparent",
                          border: "none",
                          padding: 0,
                          color: "var(--c-text-2)",
                        }}
                      >
                        {r.type}
                      </Tag>
                      <span style={{ color: "var(--c-text-3)" }}> → {r.target}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Entities list */}
      {loading && entities.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : filtered.length === 0 ? (
        <Empty
          description={<span style={{ color: "var(--c-text-3)", fontSize: 14, fontWeight: 300 }}>暂无实体</span>}
        />
      ) : (
        <List
          grid={{ gutter: 24, xs: 1, sm: 2, md: 3, lg: 4 }}
          dataSource={filtered}
          renderItem={(e) => (
            <List.Item>
              <Card
                size="small"
                hoverable
                onClick={() => selectEntity(e.id)}
                style={{
                  borderRadius: 12,
                  border: "1px solid var(--c-border)",
                  boxShadow: "var(--shadow)",
                  borderLeft: `3px solid ${typeColors[e.type] || "var(--c-text-3)"}`,
                  cursor: "pointer",
                }}
                bodyStyle={{ padding: 24 }}
              >
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: "var(--c-text)" }}>{e.name}</div>
                <Tag
                  style={{
                    background: "var(--c-hover)",
                    border: "1px solid var(--c-border)",
                    color: "var(--c-text-2)",
                    fontSize: 11,
                    fontWeight: 300,
                    borderRadius: 8,
                  }}
                >
                  {e.type}
                </Tag>
                <div
                  style={{
                    marginTop: 8,
                    color: "var(--c-text-3)",
                    fontSize: 12,
                    fontWeight: 300,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.description || "—"}
                </div>
              </Card>
            </List.Item>
          )}
        />
      )}
    </PageShell>
  );
}
