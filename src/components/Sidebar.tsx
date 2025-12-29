// FILE: src/components/Sidebar.tsx

import { NavLink, useLocation } from 'react-router-dom';
import classNames from 'classnames';
import { pageRegistry } from '../pages/registry';

export function Sidebar() {
  const { pathname } = useLocation();

  const inVideoArea =
    pathname.startsWith('/videos') ||
    pathname.startsWith('/favorites') ||
    pathname.startsWith('/manage') ||
    pathname.startsWith('/settings');

  const menuItems = pageRegistry.filter((p) => p.isMenu);

  // ★あなたの実ルートに合わせてここだけ調整（たぶん Home は "/"）
  const homePath = '/';
  const libraryPath = '/videos';

  // 動画エリアのサブ（必要なら調整）
  const videoSubPaths = [
    '/favorites',
    '/manage',
    '/settings',
  ];

  const homeItem = menuItems.find((p) => p.path === homePath);
  const libraryItem = menuItems.find((p) => p.path === libraryPath);

  const videoSubItems = videoSubPaths
    .map((path) => menuItems.find((p) => p.path === path))
    .filter(Boolean);

  // Home / Library / サブは通常メニューから除外
  const otherMenuItems = menuItems.filter(
    (p) => p.path !== homePath && p.path !== libraryPath && !videoSubPaths.includes(p.path),
  );

  const itemClass = (isActive: boolean) =>
    classNames(
      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
      isActive
        ? 'bg-bg-panel text-accent shadow-sm border border-border-light'
        : 'text-text-muted hover:text-text-main hover:bg-bg-panel/50',
    );

  const iconClass = (isActive: boolean) =>
    classNames(
      'text-xl transition-colors',
      isActive ? 'text-accent' : 'text-text-dim group-hover:text-text-main',
    );

  return (
    <aside className="w-64 h-full bg-bg-surface border-r border-border flex flex-col z-20 shadow-xl">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <h1 className="font-heading font-bold text-2xl tracking-tight text-white">
          atelier<span className="text-accent">.</span>
        </h1>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1">
        {/* ✅ 1) Home は最上段固定（/ が他のルートにマッチしないよう end 必須） */}
        <NavLink
          to={homePath}
          end
          className={({ isActive }) => itemClass(isActive)}
        >
          {({ isActive }) => (
            <>
              {homeItem?.icon ? <homeItem.icon className={iconClass(isActive)} /> : null}
              <span className="font-medium tracking-wide text-sm">{homeItem?.label ?? 'Home'}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              )}
            </>
          )}
        </NavLink>

        {/* ✅ 2) Library は常に表示（Home の下） */}
        <NavLink to={libraryPath} className={({ isActive }) => itemClass(isActive)}>
          {({ isActive }) => (
            <>
              {libraryItem?.icon ? <libraryItem.icon className={iconClass(isActive)} /> : null}
              <span className="font-medium tracking-wide text-sm">{libraryItem?.label ?? 'Library'}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              )}
            </>
          )}
        </NavLink>

        {/* ✅ 3) 動画エリアのときだけ：Library配下サブ */}
        {inVideoArea && videoSubItems.length > 0 && (
          <div className="ml-3 border-l border-border/50 pl-3 mt-1 space-y-1">
            {videoSubItems.map((item: any) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => classNames(itemClass(isActive), 'py-2')}
              >
                {({ isActive }) => (
                  <>
                    {item.icon ? <item.icon className={iconClass(isActive)} /> : null}
                    <span className="font-medium tracking-wide text-sm">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}

        {/* ✅ 4) その他メニュー */}
        {otherMenuItems.length > 0 && (
          <>
            <div className="my-3 h-px bg-border/60" />
            {otherMenuItems.map((item) => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => itemClass(isActive)}>
                {({ isActive }) => (
                  <>
                    {item.icon ? <item.icon className={iconClass(isActive)} /> : null}
                    <span className="font-medium tracking-wide text-sm">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="text-xs text-text-dim text-center font-mono">v0.1.0 local</div>
      </div>
    </aside>
  );
}

export default Sidebar;
