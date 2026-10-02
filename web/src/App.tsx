import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Workflows from "./pages/Workflows";
import Executions from "./pages/Executions";
import ExecutionDetail from "./pages/ExecutionDetail";
import Connectors from "./pages/Connectors";
import Secrets from "./pages/Secrets";
import { useEffect } from "react";
import { getToken } from "./lib/auth";
import { applyTheme, cacheTheme } from "./lib/theme";
import { getMyProfile } from "./lib/users";

const WorkflowEditor = lazy(() => import("./pages/WorkflowEditor"));
const Settings = lazy(() => import("./pages/Settings"));

function Guard({ children }: { children: JSX.Element }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

/** Sinkronkan preferensi tema backend ke UI + cache lokal saat ada sesi. */
function useBackendTheme() {
  useEffect(() => {
    if (!getToken()) return;
    getMyProfile()
      .then((u) => {
        cacheTheme(u.themePreference);
        applyTheme(u.themePreference);
      })
      .catch(() => {});
  }, []);
}

export default function App() {
  useBackendTheme();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <Guard>
              <Layout />
            </Guard>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route
            path="/workflows/:id"
            element={
              <Suspense fallback={<div className="md3-card md3-card--outlined">Memuat editor...</div>}>
                <WorkflowEditor />
              </Suspense>
            }
          />
          <Route path="/executions" element={<Executions />} />
          <Route path="/executions/:id" element={<ExecutionDetail />} />
          <Route path="/connectors" element={<Connectors />} />
          <Route path="/secrets" element={<Secrets />} />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<div className="lf-page">Memuat…</div>}>
                <Settings />
              </Suspense>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
