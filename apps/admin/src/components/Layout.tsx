import { Building2, Gift, LogOut, Palette, PanelLeftClose, PanelLeftOpen, ScanLine, Store, Users } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../api/auth";
import { t } from "../strings";
import { ThemeSwitch } from "./ThemeSwitch";
import { cx } from "./ui";

export function Wordmark({ className }: { className?: string }) {
  return <span className={cx("font-serif text-3xl italic leading-none", className)}>Kairos</span>;
}

const NAV = {
  super_admin: [{ to: "/tenants", label: t.nav.tenants, Icon: Building2 }],
  tenant_admin: [
    { to: "/caja", label: t.nav.caja, Icon: ScanLine },
    { to: "/rewards", label: t.nav.rewards, Icon: Gift },
    { to: "/stores", label: t.nav.stores, Icon: Store },
    { to: "/staff", label: t.nav.staff, Icon: Users },
    { to: "/brand", label: t.nav.brand, Icon: Palette },
  ],
  tenant_staff: [
    { to: "/caja", label: t.nav.caja, Icon: ScanLine },
    { to: "/rewards", label: t.nav.rewards, Icon: Gift },
  ],
} as const;

const COLLAPSED_KEY = "kairos-sidebar-collapsed";
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
};

/** Tooltip visible solo con la barra contraída (escritorio). */
function Tip({ children }: { children: string }) {
  return (
    <span
      role="presentation"
      className="pointer-events-none absolute left-full top-1/2 z-30 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md border-2 border-ink bg-surface px-2.5 py-1 text-xs font-bold uppercase text-ink opacity-0 shadow-hard transition-opacity duration-100 group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100 group-data-[collapsed=true]:lg:block"
    >
      {children}
    </span>
  );
}

const iconBtn =
  "group/tip relative inline-flex size-11 shrink-0 items-center justify-center rounded-md border-2 border-transparent text-ink-2 transition-colors duration-100 hover:border-ink hover:text-ink";

export function Layout() {
  const { user, logout } = useAuth();
  const items = user ? NAV[user.role] : [];
  const tenant = user && "tenant" in user ? user.tenant : null;
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase();

  function toggleSidebar() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1");
      } catch {
        /* sin almacenamiento: dura la sesión */
      }
      return !c;
    });
  }

  return (
    <div
      className={cx(
        "min-h-screen transition-[grid-template-columns] duration-150 lg:grid",
        collapsed ? "lg:grid-cols-[4.75rem_1fr]" : "lg:grid-cols-[16rem_1fr]",
      )}
    >
      <aside
        id="sidebar"
        data-collapsed={collapsed}
        className="group flex items-center justify-between gap-4 border-b-2 border-line bg-surface px-4 py-3 lg:sticky lg:top-0 lg:h-screen lg:flex-col lg:items-stretch lg:justify-start lg:gap-6 lg:border-b-0 lg:border-r-2 lg:px-3 lg:py-4"
      >
        <div className={cx("flex items-center gap-2", collapsed ? "lg:flex-col lg:gap-3" : "lg:justify-between lg:pl-2")}>
          <div className={cx("flex items-baseline gap-2", collapsed && "lg:hidden")}>
            <Wordmark className="text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink-3">Admin</span>
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={!collapsed}
            aria-controls="sidebar"
            aria-label={collapsed ? t.common.sidebar.expand : t.common.sidebar.collapse}
            className={cx(iconBtn, "hidden lg:inline-flex")}
          >
            {collapsed ? <PanelLeftOpen size={20} aria-hidden /> : <PanelLeftClose size={20} aria-hidden />}
            <Tip>{collapsed ? t.common.sidebar.expand : t.common.sidebar.collapse}</Tip>
          </button>
        </div>

        {tenant && (
          <div
            title={tenant.name}
            className={cx("hidden items-center gap-3 rounded-md border-2 border-line p-2 lg:flex", collapsed && "lg:justify-center lg:border-transparent lg:p-0")}
          >
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt="" className="size-9 shrink-0 rounded-sm object-contain" />
            ) : (
              <span aria-hidden className="size-9 shrink-0 rounded-sm" style={{ background: tenant.primaryColor }} />
            )}
            <span className={cx("truncate text-sm font-bold", collapsed && "lg:hidden")}>{tenant.name}</span>
          </div>
        )}

        <nav aria-label="Principal" className="hidden flex-col gap-1 lg:flex">
          <p className={cx("mb-1 px-3 text-xs font-bold uppercase tracking-wider text-ink-3", collapsed && "lg:sr-only")}>
            {t.common.sidebar.menu}
          </p>
          {items.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              className={({ isActive }) =>
                cx(
                  "group/tip relative flex min-h-11 items-center gap-3 rounded-md px-3 font-display text-lg font-bold uppercase tracking-wide transition-colors duration-100",
                  collapsed && "lg:justify-center lg:px-0",
                  isActive
                    ? "bg-primary/15 text-ink before:absolute before:inset-y-1 before:left-0 before:w-1 before:rounded-sm before:bg-primary"
                    : "text-ink-2 hover:bg-line/60 hover:text-ink",
                )
              }
            >
              <Icon size={20} aria-hidden className="shrink-0" />
              <span className={cx(collapsed && "lg:hidden")}>{label}</span>
              <Tip>{label}</Tip>
            </NavLink>
          ))}
        </nav>

        <div
          className={cx(
            "flex items-center gap-2 lg:mt-auto lg:border-t-2 lg:border-line lg:pt-4",
            collapsed ? "lg:flex-col" : "lg:justify-between",
          )}
        >
          <div className={cx("hidden min-w-0 items-center gap-3 px-1 lg:flex", collapsed && "lg:px-0")} title={user?.name}>
            <span
              aria-hidden
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border-2 border-ink font-display text-lg font-black"
            >
              {initial}
            </span>
            <div className={cx("min-w-0", collapsed && "lg:hidden")}>
              <p className="truncate text-sm font-bold">{user?.name}</p>
              <p className="truncate text-xs text-ink-2">{user ? t.role[user.role] : ""}</p>
            </div>
          </div>
          <button type="button" onClick={() => void logout()} aria-label={t.common.logout} className={cx(iconBtn, "hover:border-danger hover:text-danger")}>
            <LogOut size={18} aria-hidden />
            <Tip>{t.common.logout}</Tip>
          </button>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 lg:py-8">
        <div className="mb-4 flex justify-end">
          <ThemeSwitch />
        </div>
        {items.length > 1 && (
          <nav aria-label="Principal" className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b-2 border-line px-4 pb-3 sm:-mx-8 sm:px-8 lg:hidden">
            {items.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cx(
                    "flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 font-display text-base font-bold uppercase tracking-wide",
                    isActive ? "bg-primary/15 text-ink shadow-[inset_0_-3px_0_0_var(--kairos-primary)]" : "text-ink-2",
                  )
                }
              >
                <Icon size={18} aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        )}
        <Outlet />
      </main>
    </div>
  );
}
