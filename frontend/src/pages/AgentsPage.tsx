import { useState } from "react";
import { Button, Modal, Form, Input, message } from "antd";
import { PlusOutlined, TeamOutlined } from "@ant-design/icons";
import { PageShell } from "../components/common/PageShell";
import { useAgentStore } from "../stores/agentStore";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import { useEffect } from "react";

export default function AgentsPage() {
  const { agents, fetchAgents } = useAgentStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleCreate = async () => {
    const values = await form.validateFields();
    // TODO: implement actual agent creation API
    message.info(`智能体 "${values.name}" 创建功能即将上线`);
    setModalOpen(false);
    form.resetFields();
  };

  return (
    <PageShell
      title="智能体"
      subtitle="管理 AI 智能体与代理任务"
      icon={<TeamOutlined />}
      actions={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ height: 40, fontWeight: 600 }}
          onClick={() => setModalOpen(true)}
        >
          新建智能体
        </Button>
      }
    >
      {agents.length === 0 ? (
        <EmptyState description="暂无智能体" actionLabel="创建第一个智能体" onAction={() => setModalOpen(true)} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
          {agents.map((a) => (
            <div
              key={a.id}
              style={{
                padding: 32,
                borderRadius: 12,
                border: "1px solid var(--c-border)",
                background: "var(--c-card)",
                boxShadow: "var(--shadow)",
                transition: "box-shadow 200ms",
                cursor: "default",
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
                  fontWeight: 600,
                  fontSize: 16,
                  color: "var(--c-text)",
                  marginBottom: 8,
                  lineHeight: 1.3,
                  fontFamily: '"Inter", sans-serif',
                }}
              >
                {a.name}
              </div>
              <div
                style={{
                  color: "var(--c-text-2)",
                  fontSize: 14,
                  fontWeight: 300,
                  lineHeight: 1.6,
                  marginBottom: 20,
                  minHeight: 44,
                }}
              >
                {a.description}
              </div>
              <StatusBadge status={a.enabled ? "ok" : "disconnected"} />
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={<span style={{ fontWeight: 600, fontSize: 16, color: "var(--c-text)" }}>新建智能体</span>}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        okText="创建"
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: "请输入智能体名称" }]}>
            <Input placeholder="例如: 代码助手" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="描述智能体的功能..." />
          </Form.Item>
        </Form>
      </Modal>
    </PageShell>
  );
}
