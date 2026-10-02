import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Cable, History, Home, KeyRound, Settings2, WorkflowIcon } from "./icons";
import { clearToken, getUser } from "../lib/auth";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/workflows", label: "Flows", icon: WorkflowIcon, end: false },
  { to: "/executions", label: "Runs", icon: History, end: false },
  { to: "/connectors", label: "Connect", icon: Cable, end: false },
  { to: "/secrets", label: "Secrets", icon: KeyRound, end: false },
  { to: "/settings", label: "Settings", icon: Settings2, end: false },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();

  function logout() {
    clearToken();
    navigate("/login");
  }

  const onBuilder = location.pathname.startsWith("/workflows/") && location.pathname !== "/workflows";

  return (
    <div className="lf-shell">
      <header className="lf-top">
        <span className="lf-brand">Light<em>Flow</em></span>
        <span className="lf-top-title" />
        {user && (
          <span className="lf-user">{user.displayName || user.username} · {user.role}</span>
        )}
        {user && (
          <button type="button" className="lf-btn lf-btn--tertiary" onClick={logout} title="Keluar">
            Logout
          </button>
        )}
      </header>
      <div className="lf-body">
        <nav className="lf-side" aria-label="Navigasi utama">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => "lf-nav" + (isActive ? " active" : "")}
                title={n.label}
              >
                <span className="lf-nav-ic"><Icon size={19} aria-hidden /></span>
                {n.label}
              </NavLink>
            );
          })}
        </nav>
        <main className="lf-main" style={onBuilder ? { padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" } : undefined}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
