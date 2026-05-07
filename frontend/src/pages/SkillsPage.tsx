import { useState, useEffect } from "react";
import { Button, Tag, Table, Drawer, Form, Input, Select, message, Statistic } from "antd";
import { ThunderboltOutlined, ReloadOutlined, PlusOutlined } from "@ant-design/icons";
import { PageShell } from "../components/common/PageShell";
import { skillsApi, type Skill, type SkillStats } from "../api/skills";
import { EmptyState } from "../components/common/EmptyState";

const { TextArea } = Input;

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [stats, setStats] = useState<SkillStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([skillsApi.list(), skillsApi.stats()]);
      setSkills(list);
      setStats(s);
    } catch (e: any) {
      message.error("Failed to load skills: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (values: any) => {
    try {
      await skillsApi.create({
        name: values.name,
        description: values.description,
        code: values.code,
        language: values.language,
        triggerPatterns: values.triggerPatterns?.split(",").map((s: string) => s.trim()).filter(Boolean),
        tags: values.tags?.split(",").map((s: string) => s.trim()).filter(Boolean),
      });
      message.success("Skill created");
      setDrawerOpen(false);
      form.resetFields();
      fetchData();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (_: string, s: Skill) => (
        <div>
          <div style={{ fontWeight: 600 }}>{s.name}</div>
          <div style={{ fontSize: 12, color: "var(--c-text-3)" }}>{s.id}</div>
        </div>
      ),
    },
    {
      title: "Language",
      dataIndex: "language",
      key: "language",
      width: 100,
      render: (v: string) => <Tag >{v}</Tag>,
    },
    {
      title: "Usage",
      key: "usage",
      width: 120,
      render: (_: unknown, s: Skill) => (
        <div style={{ fontSize: 12 }}>
          <div>{s.usageCount} invocations</div>
          <div style={{ color: "var(--c-text-3)" }}>{(s.successRate * 100).toFixed(0)}% success</div>
        </div>
      ),
    },
    {
      title: "Triggers",
      key: "triggers",
      render: (_: unknown, s: Skill) => (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {s.triggerPatterns.map((t) => (
            <Tag key={t} >{t}</Tag>
          ))}
        </div>
      ),
    },
  ];

  return (
    <PageShell
      title="Skills"
      subtitle={`${skills.length} skill(s) registered`}
      icon={<ThunderboltOutlined />}
    >
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 24 }}>
          {stats && (
            <>
              <Statistic title="Total Skills" value={stats.totalSkills} />
              <Statistic title="Invocations" value={stats.totalInvocations} />
              <Statistic title="Success Rate" value={(stats.averageSuccessRate * 100).toFixed(0)} suffix="%" />
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            New Skill
          </Button>
        </div>
      </div>

      {skills.length === 0 && !loading ? (
        <EmptyState description="No skills registered" />
      ) : (
        <Table
          dataSource={skills}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          
        />
      )}

      <Drawer
        title="Create Skill"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g., summarize_text" />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <Input placeholder="What does this skill do?" />
          </Form.Item>
          <Form.Item name="language" label="Language" rules={[{ required: true }]} initialValue="python">
            <Select options={[
              { label: "Python", value: "python" },
              { label: "JavaScript", value: "javascript" },
              { label: "TypeScript", value: "typescript" },
            ]} />
          </Form.Item>
          <Form.Item name="code" label="Code" rules={[{ required: true }]}>
            <TextArea rows={8} placeholder="def run(params): ..." />
          </Form.Item>
          <Form.Item name="triggerPatterns" label="Trigger Patterns (comma-separated)">
            <Input placeholder="e.g., summarize, tl;dr" />
          </Form.Item>
          <Form.Item name="tags" label="Tags (comma-separated)">
            <Input placeholder="e.g., text, automation" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Create
            </Button>
          </Form.Item>
        </Form>
      </Drawer>
    </PageShell>
  );
}
