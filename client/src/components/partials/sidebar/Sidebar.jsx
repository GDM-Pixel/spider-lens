import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import logo from "../../../assets/spider-lens-logo.png";

const NAV_ITEMS = [
  { key: "dashboard", icon: "ph:chart-pie-slice", path: "/dashboard" },
  { key: "httpCodes", icon: "ph:chart-line",            path: "/http-codes" },
  { key: "topPages",  icon: "ph:list-magnifying-glass", path: "/top-pages" },
  { key: "bots",      icon: "ph:robot",                 path: "/bots" },
  { key: "ttfb",      icon: "ph:gauge",                 path: "/ttfb" },
  { key: "network",   icon: "ph:network",               path: "/network" },
  { key: "anomalies", icon: "ph:warning-diamond",       path: "/anomalies" },
  { key: "blocklist", icon: "ph:export",                path: "/blocklist" },
  { key: "analyzeAI", icon: "ph:sparkle",               path: "/assistant" },
  { key: "settings",  icon: "ph:gear-six",              path: "/settings" },
];

export default function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  function handleLogout() {
    localStorage.removeItem("spider_token");
    localStorage.removeItem("spider_username");
    navigate("/login");
  }

  return (
    <aside
      className={clsx(
        "fixed top-0 left-0 h-full bg-prussian-600 flex flex-col z-40 transition-all duration-200 border-r border-prussian-500",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-24 px-4 border-b border-prussian-500 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {collapsed ? (
            <Icon
              icon="ph:spider"
              className="text-moonstone-400 text-2xl shrink-0"
            />
          ) : (
            <img
              src={logo}
              alt="Spider-Lens"
              className="h-16 w-auto shrink-0"
            />
          )}
        </div>
        <button
          onClick={onToggle}
          className={clsx(
            "ml-auto text-errorgrey hover:text-white transition-colors shrink-0",
            collapsed && "hidden",
          )}
        >
          <Icon icon="ph:sidebar-simple" className="text-lg" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 flex flex-col gap-1">
        {!collapsed && (
          <p className="text-errorgrey text-xs font-semibold uppercase tracking-wider px-2 mb-2">
            {t('nav.analysis')}
          </p>
        )}
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 group",
                isActive
                  ? "bg-prussian-500 text-white border-l-2 border-dustyred-400 pl-[6px]"
                  : "text-lightgrey hover:bg-prussian-500 hover:text-white border-l-2 border-transparent",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  icon={item.icon}
                  className={clsx(
                    "text-xl shrink-0",
                    isActive
                      ? "text-moonstone-400"
                      : "text-errorgrey group-hover:text-moonstone-400",
                  )}
                />
                {!collapsed && <span className="truncate">{t(`nav.${item.key}`)}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-prussian-500 p-2">
        <NavLink
          to="/account"
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-3 w-full px-2 py-2.5 rounded-lg text-sm font-semibold transition-colors mb-1",
              collapsed && "justify-center",
              isActive
                ? "bg-prussian-500 text-white"
                : "text-errorgrey hover:bg-prussian-500 hover:text-white",
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                icon="ph:user"
                className={clsx("text-xl shrink-0", isActive ? "text-moonstone-400" : "text-errorgrey")}
              />
              {!collapsed && <span>{t('nav.account')}</span>}
            </>
          )}
        </NavLink>
        <button
          onClick={handleLogout}
          className={clsx(
            "flex items-center gap-3 w-full px-2 py-2.5 rounded-lg text-sm text-errorgrey hover:bg-prussian-500 hover:text-dustyred-400 transition-colors",
            collapsed && "justify-center",
          )}
        >
          <Icon icon="ph:sign-out" className="text-xl shrink-0" />
          {!collapsed && <span>{t('nav.logout')}</span>}
        </button>
        {!collapsed && (
          <p className="text-left text-xs text-white px-2 mt-2 mb-1">
            Créé avec <span className="text-red-500">♥</span> par{' '}
            <a
              href="https://www.gdm-pixel.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-moonstone-400 hover:text-moonstone-300 transition-colors"
            >
              GDM-Pixel
            </a>
          </p>
        )}
      </div>
    </aside>
  );
}
