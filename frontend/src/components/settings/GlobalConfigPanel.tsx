import { useEffect } from "react";
import { Form, Switch, Select, InputNumber, Button, message, Spin } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useConfigStore } from "../../stores/configStore";

export default function GlobalConfigPanel() {
  const [form] = Form.useForm();
  const { globalConfig, loading, fetchGlobalConfig, saveGlobalConfig } = useConfigStore();

  useEffect(() => {
    fetchGlobalConfig();
  }, [fetchGlobalConfig]);

  useEffect(() => {
    if (globalConfig) {
      form.setFieldsValue(globalConfig);
    }
  }, [globalConfig, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    await saveGlobalConfig(values);
    message.success("通用配置已保存");
  };

  return (
    <Spin spinning={loading}>
      <Form form={form} layout="vertical" style={{ maxWidth: 500 }}>
        <Form.Item label="Debug 模式" name="debug" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item label="日志级别" name="logLevel">
          <Select
            options={[
              { label: "Debug", value: "debug" },
              { label: "Info", value: "info" },
              { label: "Warning", value: "warning" },
              { label: "Error", value: "error" },
            ]}
          />
        </Form.Item>

        <Form.Item label="最大并发工具数" name="maxConcurrentTools">
          <InputNumber min={1} max={64} style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item label="工具超时 (毫秒)" name="toolTimeoutMs">
          <InputNumber min={1000} max={300000} step={1000} style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item label="需要确认" name="requireConfirmation" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item label="白名单模式" name="whitelistMode">
          <Select
            options={[
              { label: "严格 (strict)", value: "strict" },
              { label: "宽松 (permissive)", value: "permissive" },
            ]}
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
            保存配置
          </Button>
        </Form.Item>
      </Form>
    </Spin>
  );
}
