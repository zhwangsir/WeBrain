import { useNavigate } from "react-router-dom";
import { Badge, Button, Dropdown, Avatar, Tooltip } from "antd";
import { BellOutlined, SettingOutlined, SunOutlined, MoonOutlined, MenuOutlined } from "@ant-design/icons";
import { useSystemStore } from "../../stores/systemStore";

interface HeaderBarProps {
  onMenuClick?: () => void;
}

export function HeaderBar({ onMenuClick }: HeaderBarProps) {
  const navigate = useNavigate();
  const { notifications, markNotificationRead, health, theme, toggleTheme } = useSystemStore();

  const unreadCount = notifications.filter((n) => !n.read).length;
  const isHealthy = health?.status === "ok";

  const notificationItems = notifications.slice(0, 8).map((n) => ({
    key: n.id,
    label: (
      <div
        style={{
          padding: "6px 0",
          maxWidth: 320,
          cursor: "pointer",
        }}
        onClick={() => markNotificationRead(n.id)}
      >
        <div
          style={{
            fontWeight: n.read ? 400 : 600,
            fontSize: 13,
            color: n.read ? "var(--c-text-2)" : "var(--c-text)",
            lineHeight: 1.4,
          }}
        >
          {n.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--c-text-3)",
            fontWeight: 300,
            lineHeight: 1.4,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginTop: 2,
          }}
        >
          {n.message}
        </div>
      </div>
    ),
  }));

  const userItems = [{ key: "settings", icon: <SettingOutlined />, label: "设置" }];

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: 64,
        background: "var(--c-card)",
        borderBottom: "1px solid var(--c-border)",
        padding: "0 48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: '"Inter", sans-serif',
      }}
    >
      {/* Left: mobile menu + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Button
          type="text"
          className="sidebar-mobile-toggle"
          icon={<MenuOutlined style={{ fontSize: 18, color: "var(--c-text)" }} />}
          onClick={onMenuClick}
          style={{ width: 36, height: 36, marginRight: 4 }}
        />
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: isHealthy ? "var(--c-success)" : "var(--c-error)",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 13,
            fontWeight: 400,
            color: isHealthy ? "var(--c-success)" : "var(--c-error)",
            letterSpacing: "0.01em",
          }}
        >
          {isHealthy ? "系统正常运行" : "系统异常"}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Theme toggle — binary light/dark */}
        <Tooltip title={theme === "dark" ? "切换到浅色" : "切换到深色"}>
          <Button
            type="text"
            icon={
              theme === "dark" ? (
                <SunOutlined style={{ fontSize: 16, color: "var(--c-text-2)" }} />
              ) : (
                <MoonOutlined style={{ fontSize: 16, color: "var(--c-text-2)" }} />
              )
            }
            onClick={toggleTheme}
            style={{ width: 36, height: 36 }}
          />
        </Tooltip>

        <Dropdown menu={{ items: notificationItems }} placement="bottomRight" arrow>
          <Badge count={unreadCount} size="small" offset={[-2, 2]} color="var(--c-error)">
            <Button
              type="text"
              icon={<BellOutlined style={{ fontSize: 16, color: "var(--c-text-2)" }} />}
              style={{ width: 36, height: 36 }}
            />
          </Badge>
        </Dropdown>

        <Dropdown
          menu={{ items: userItems, onClick: ({ key }) => key === "settings" && navigate("/settings") }}
          placement="bottomRight"
          arrow
        >
          <Avatar
            size={32}
            style={{
              background: "var(--c-hover)",
              color: "var(--c-text-2)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            U
          </Avatar>
        </Dropdown>
      </div>
    </header>
  );
}
