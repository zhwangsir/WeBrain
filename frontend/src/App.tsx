/**
 * WeBrain App — Single ConfigProvider, dual-theme, command palette
 */

import { useEffect, lazy, Suspense, useState, useMemo, useRef } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { ConfigProvider, Modal, Input, List } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { useSystemStore } from "./stores/systemStore";
import { useThemeSync } from "./hooks/useTheme";
import { AppLayout } from "./components/layout/AppLayout";
import LazyPage from "./components/common/LazyPage";
import { getAntdTheme } from "./styles/theme";
import { SearchOutlined } from "@ant-design/icons";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const AgentsPage = lazy(() => import("./pages/AgentsPage"));
const ToolsPage = lazy(() => import("./pages/ToolsPage"));
const PluginsPage = lazy(() => import("./pages/PluginsPage"));
const SkillsPage = lazy(() => import("./pages/SkillsPage"));
const MemoryPage = lazy(() => import("./pages/MemoryPage"));
const WikiPage = lazy(() => import("./pages/WikiPage"));
const KnowledgeGraphPage = lazy(() => import("./pages/KnowledgeGraphPage"));
const ChannelsPage = lazy(() => import("./pages/ChannelsPage"));
const CronPage = lazy(() => import("./pages/CronPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

const commands = [
  { label: "Dashboard", action: (nav: ReturnType<typeof useNavigate>) => nav("/") },
  { label: "Chat", action: (nav: ReturnType<typeof useNavigate>) => nav("/chat") },
  { label: "Agents", action: (nav: ReturnType<typeof useNavigate>) => nav("/agents") },
  { label: "Tools", action: (nav: ReturnType<typeof useNavigate>) => nav("/tools") },
  { label: "Plugins", action: (nav: ReturnType<typeof useNavigate>) => nav("/plugins") },
  { label: "Skills", action: (nav: ReturnType<typeof useNavigate>) => nav("/skills") },
  { label: "Memory", action: (nav: ReturnType<typeof useNavigate>) => nav("/memory") },
  { label: "Wiki", action: (nav: ReturnType<typeof useNavigate>) => nav("/wiki") },
  { label: "Knowledge Graph", action: (nav: ReturnType<typeof useNavigate>) => nav("/kg") },
  { label: "Channels", action: (nav: ReturnType<typeof useNavigate>) => nav("/channels") },
  { label: "Cron", action: (nav: ReturnType<typeof useNavigate>) => nav("/cron") },
  { label: "Settings", action: (nav: ReturnType<typeof useNavigate>) => nav("/settings") },
];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useSystemStore();
  useThemeSync();

  const isDark = theme === "dark";
  const antdThemeConfig = useMemo(() => getAntdTheme(isDark), [isDark]);

  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");

  // Route loading progress
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      NProgress.start();
      prevPathRef.current = location.pathname;
      const timer = setTimeout(() => NProgress.done(), 300);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(commandQuery.toLowerCase()));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        Modal.info({
          title: "Keyboard Shortcuts",
          content: (
            <div style={{ whiteSpace: "pre-line" }}>
              {`Cmd/Ctrl + K    Command palette
Cmd/Ctrl + /    Shortcuts help`}
            </div>
          ),
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <AppLayout>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <Suspense fallback={<LazyPage />}>
              <Routes location={location}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="/tools" element={<ToolsPage />} />
                <Route path="/plugins" element={<PluginsPage />} />
                <Route path="/skills" element={<SkillsPage />} />
                <Route path="/memory" element={<MemoryPage />} />
                <Route path="/wiki" element={<WikiPage />} />
                <Route path="/kg" element={<KnowledgeGraphPage />} />
                <Route path="/channels" element={<ChannelsPage />} />
                <Route path="/cron" element={<CronPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </AppLayout>

      {/* NProgress theme override */}
      <style>{`
        #nprogress .bar { background: var(--c-accent) !important; height: 2px !important; }
        #nprogress .peg { box-shadow: 0 0 10px var(--c-accent), 0 0 5px var(--c-accent) !important; }
        #nprogress .spinner-icon { border-top-color: var(--c-accent) !important; border-left-color: var(--c-accent) !important; }
      `}</style>

      <Modal
        open={commandOpen}
        onCancel={() => {
          setCommandOpen(false);
          setCommandQuery("");
        }}
        footer={null}
        title="Command Palette"
        width={480}
      >
        <Input
          prefix={<SearchOutlined />}
          placeholder="Type a command..."
          value={commandQuery}
          onChange={(e) => setCommandQuery(e.target.value)}
          autoFocus
        />
        <List
          dataSource={filtered}
          renderItem={(item) => (
            <List.Item
              style={{ cursor: "pointer" }}
              onClick={() => {
                item.action(navigate);
                setCommandOpen(false);
                setCommandQuery("");
              }}
            >
              {item.label}
            </List.Item>
          )}
          style={{ marginTop: 8, maxHeight: 300, overflow: "auto" }}
        />
      </Modal>
    </ConfigProvider>
  );
}
