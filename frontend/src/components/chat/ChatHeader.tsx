import { Button, Popconfirm, Tooltip, Select, message } from "antd";
import { SearchOutlined, FileTextOutlined, ToolOutlined, ClearOutlined } from "@ant-design/icons";
import { useSystemStore } from "../../stores/systemStore";
import { useConfigStore } from "../../stores/configStore";
import { configApi } from "../../api/config";

interface ChatHeaderProps {
  title: string;
  streaming: boolean;
  toolEnabled: boolean;
  onToggleTool: () => void;
  showSearch: boolean;
  onToggleSearch: () => void;
  onExport: () => void;
  onClear: () => void;
  messagesCount: number;
}

export default function ChatHeader({
  title,
  streaming,
  toolEnabled,
  onToggleTool,
  showSearch,
  onToggleSearch,
  onExport,
  onClear,
  messagesCount,
}: ChatHeaderProps) {
  const { modelHealth } = useSystemStore();
  const { modelConfig } = useConfigStore();

  const C = {
    border: "var(--c-border)",
    text: "var(--c-text)",
    text2: "var(--c-text-2)",
    text3: "var(--c-text-3)",
    textInv: "var(--c-text-inv)",
    success: "var(--c-success)",
    error: "var(--c-error)",
    accent: "var(--c-accent)",
  };

  return (
    <div
      style={{
        height: 52,
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {streaming && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: C.success,
              display: "inline-block",
              animation: "chatPulse 1.5s ease-in-out infinite",
              flexShrink: 0,
            }}
          />
        )}
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: C.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </span>
        {streaming && <span style={{ fontSize: 12, color: C.success, fontWeight: 400 }}>生成中…</span>}
      </div>

      {/* Model selector */}
      {modelHealth && modelHealth.endpoints && Object.keys(modelHealth.endpoints).length > 0 && (
        <div style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0, padding: "0 16px" }}>
          <Select
            size="small"
            variant="borderless"
            popupMatchSelectWidth={false}
            style={{ minWidth: 140, color: C.text2 }}
            value={modelConfig?.modelId || ""}
            onSelect={async (value: string) => {
              const ep = Object.entries(modelHealth.endpoints as Record<string, any>).find(
                ([, v]) => v.model_id === value
              );
              if (ep) {
                const [, info] = ep;
                try {
                  await configApi.setModel({ baseUrl: info.base_url, modelId: info.model_id });
                  message.success(`已切换模型: ${info.model_id}`);
                  useConfigStore.getState().fetchModelConfig?.();
                } catch (e: any) {
                  message.error(e.message || "切换模型失败");
                }
              }
            }}
            options={Object.entries(modelHealth.endpoints as Record<string, any>).map(([name, info]) => ({
              label: (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: info.healthy ? C.success : C.error,
                      display: "inline-block",
                    }}
                  />
                  <span>{info.model_id}</span>
                  <span style={{ fontSize: 11, color: C.text3, marginLeft: 4 }}>{name}</span>
                </div>
              ),
              value: info.model_id,
            }))}
          />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {messagesCount > 0 && (
          <>
            <Tooltip title="搜索消息">
              <Button
                type="text"
                size="small"
                icon={<SearchOutlined />}
                onClick={onToggleSearch}
                style={{ color: showSearch ? C.accent : C.text3, height: 28, padding: "0 8px" }}
              />
            </Tooltip>
            <Tooltip title="导出对话">
              <Button
                type="text"
                size="small"
                icon={<FileTextOutlined />}
                onClick={onExport}
                style={{ color: C.text3, height: 28, padding: "0 8px" }}
              />
            </Tooltip>
          </>
        )}
        <Tooltip title={toolEnabled ? "工具调用已开启" : "工具调用已关闭"}>
          <Button
            type="text"
            size="small"
            icon={<ToolOutlined />}
            onClick={onToggleTool}
            style={{ color: toolEnabled ? C.success : C.text3, fontSize: 13, height: 28, padding: "0 8px" }}
          >
            {toolEnabled ? "ON" : "OFF"}
          </Button>
        </Tooltip>
        {messagesCount > 0 && (
          <Popconfirm
            title="清空对话"
            description="清空当前对话内容？"
            onConfirm={onClear}
            okText="清空"
            cancelText="取消"
            okButtonProps={{ danger: true, size: "small" }}
          >
            <Button
              type="text"
              size="small"
              icon={<ClearOutlined />}
              style={{ color: C.text3, height: 28, padding: "0 8px" }}
            >
              清空
            </Button>
          </Popconfirm>
        )}
      </div>
    </div>
  );
}
