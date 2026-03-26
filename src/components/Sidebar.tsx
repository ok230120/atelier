// FILE: src/components/Sidebar.tsx
import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import classNames from 'classnames';
import { Menu } from 'lucide-react';
import { pageRegistry } from '../pages/registry';

interface SidebarProps {
  isOverlay?: boolean; // オーバーレイモードかどうか
  isOpen?: boolean; // 外部から開閉状態を制御
  onToggle?: (isOpen: boolean) => void; // 開閉状態の変更を通知
}

export function Sidebar({ isOverlay = false, isOpen = true, onToggle }: SidebarProps) {
  const { pathname } = useLocation();

  const inVideoArea =
    pathname.startsWith('/videos') ||
    pathname.startsWith('/video') ||
    pathname.startsWith('/favorites') ||
    pathname.startsWith('/manage') ||
    pathname.startsWith('/settings');

  const inNovelArea = pathname.startsWith('/novels');

  const menuItems = pageRegistry.filter((p) => p.isMenu);

  const homePath = '/';
  const libraryPath = '/videos';
  const novelsPath = '/novels';

  const videoSubPaths = ['/favorites', '/manage', '/settings'];
  const novelSubPaths = ['/novels/favorites', '/novels/manage'];

  const homeItem = menuItems.find((p) => p.path === homePath);
  const libraryItem = menuItems.find((p) => p.path === libraryPath);
  const novelsItem = menuItems.find((p) => p.path === novelsPath);

  const videoSubItems = videoSubPaths
    .map((path) => menuItems.find((p) => p.path === path))
    .filter(Boolean);

  const novelSubItems = novelSubPaths
    .map((path) => menuItems.find((p) => p.path === path))
    .filter(Boolean);

  const otherMenuItems = menuItems.filter(
    (p) =>
      p.path !== homePath &&
      p.path !== libraryPath &&
      p.path !== novelsPath &&
      !videoSubPaths.includes(p.path) &&
      !novelSubPaths.includes(p.path),
  );

  const handleToggle = () => {
    if (onToggle) {
      onToggle(!isOpen);
    }
  };

  const itemClass = (isActive: boolean, _isSubItem = false) =>
    classNames(
      'relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
      isActive
        ? 'bg-bg-panel text-accent shadow-sm border border-border-light'
        : 'text-text-muted hover:text-text-main hover:bg-bg-panel/50',
    );

  const iconClass = (isActive: boolean, isSubItem = false) =>
    classNames(
      'relative z-10 transition-colors transition-transform duration-200',
      isActive ? 'text-accent' : 'text-text-dim group-hover:text-text-main',
      !isOpen && isSubItem ? 'text-lg' : 'text-xl',
      !isOpen && isSubItem && (isActive ? 'opacity-100 scale-100' : 'opacity-80 scale-90'),
      !isOpen && isSubItem && !isActive && 'group-hover:opacity-95 group-hover:scale-95',
    );

  // オーバーレイは「展開時のみ」適用
  const shouldOverlay = isOverlay;

  return (
    <aside
      className={classNames(
        'h-full bg-bg-surface border-r border-border flex flex-col shadow-xl transition-all duration-300 ease-in-out',
        isOpen ? 'w-64' : 'w-[72px]',
        // 展開時かつオーバーレイモードの場合のみfixed
        shouldOverlay ? 'fixed left-0 top-0 z-50' : 'z-20',
      )}
    >
      {/* ヘッダー */}
      <div className="h-16 flex items-center px-4 border-b border-border">
        <button
          onClick={handleToggle}
          className="p-2 hover:bg-bg-panel/50 rounded-lg transition-colors mr-2"
          aria-label="Toggle sidebar"
        >
          <Menu className="text-xl text-text-muted" />
        </button>

        {isOpen && (
          <h1 className="font-heading font-bold text-2xl tracking-tight text-white">
            atelier<span className="text-accent">.</span>
          </h1>
        )}
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {/* Home */}
        <NavLink
          to={homePath}
          end
          className={({ isActive }) => itemClass(isActive)}
          title={!isOpen ? homeItem?.label ?? 'Home' : undefined}
        >
          {({ isActive }) => (
            <>
              {homeItem?.icon ? <homeItem.icon className={iconClass(isActive)} /> : null}
              {isOpen && (
                <>
                  <span className="font-medium tracking-wide text-sm whitespace-nowrap">
                    {homeItem?.label ?? 'Home'}
                  </span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                  )}
                </>
              )}
              {!isOpen && isActive && (
                <div className="absolute left-0 w-1 h-8 bg-accent rounded-r-full" />
              )}
            </>
          )}
        </NavLink>

        {/* Library */}
        <NavLink
          to={libraryPath}
          className={({ isActive }) =>
            classNames(
              itemClass(isActive || inVideoArea),
              !isOpen && inVideoArea && 'border border-border-light bg-bg-panel/20',
            )
          }
          title={!isOpen ? libraryItem?.label ?? 'Library' : undefined}
        >
          {({ isActive }) => {
            const parentActive = isActive || inVideoArea;
            return (
              <>
                {libraryItem?.icon ? (
                  <libraryItem.icon className={iconClass(parentActive)} />
                ) : null}
                {isOpen && (
                  <>
                    <span className="font-medium tracking-wide text-sm whitespace-nowrap">
                      {libraryItem?.label ?? 'Library'}
                    </span>
                    {parentActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    )}
                  </>
                )}
                {!isOpen && parentActive && (
                  <div className="absolute left-0 w-1 h-8 bg-accent rounded-r-full" />
                )}
              </>
            );
          }}
        </NavLink>

        {/* 動画エリアのサブメニュー */}
        {inVideoArea && videoSubItems.length > 0 && (
          <div
            className={classNames(
              isOpen ? 'ml-3 border-l border-border/50 pl-3' : '',
              'mt-1 space-y-1',
            )}
          >
            {videoSubItems.map((item: any) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => classNames(itemClass(isActive, true), 'py-2')}
                title={!isOpen ? item.label : undefined}
              >
                {({ isActive }) => (
                  <>
                    {!isOpen && (
                      <span
                        aria-hidden
                        className={classNames(
                          'pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-[2px] h-8 rounded-full transition-colors',
                          isActive ? 'bg-accent' : 'bg-border/60 group-hover:bg-border/90',
                        )}
                      />
                    )}

                    {item.icon ? <item.icon className={iconClass(isActive, true)} /> : null}

                    {isOpen && (
                      <>
                        <span className="font-medium tracking-wide text-sm whitespace-nowrap">
                          {item.label}
                        </span>
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                        )}
                      </>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}

        {/* Novels */}
        <NavLink
          to={novelsPath}
          className={({ isActive }) =>
            classNames(
              itemClass(isActive || inNovelArea),
              !isOpen && inNovelArea && 'border border-border-light bg-bg-panel/20',
            )
          }
          title={!isOpen ? novelsItem?.label ?? 'Novels' : undefined}
        >
          {({ isActive }) => {
            const parentActive = isActive || inNovelArea;
            return (
              <>
                {novelsItem?.icon ? <novelsItem.icon className={iconClass(parentActive)} /> : null}
                {isOpen && (
                  <>
                    <span className="font-medium tracking-wide text-sm whitespace-nowrap">
                      {novelsItem?.label ?? 'Novels'}
                    </span>
                    {parentActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    )}
                  </>
                )}
                {!isOpen && parentActive && (
                  <div className="absolute left-0 w-1 h-8 bg-accent rounded-r-full" />
                )}
              </>
            );
          }}
        </NavLink>

        {/* Novelsエリアのサブメニュー */}
        {inNovelArea && novelSubItems.length > 0 && (
          <div
            className={classNames(
              isOpen ? 'ml-3 border-l border-border/50 pl-3' : '',
              'mt-1 space-y-1',
            )}
          >
            {novelSubItems.map((item: any) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => classNames(itemClass(isActive, true), 'py-2')}
                title={!isOpen ? item.label : undefined}
              >
                {({ isActive }) => (
                  <>
                    {!isOpen && (
                      <span
                        aria-hidden
                        className={classNames(
                          'pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-[2px] h-8 rounded-full transition-colors',
                          isActive ? 'bg-accent' : 'bg-border/60 group-hover:bg-border/90',
                        )}
                      />
                    )}

                    {item.icon ? <item.icon className={iconClass(isActive, true)} /> : null}

                    {isOpen && (
                      <>
                        <span className="font-medium tracking-wide text-sm whitespace-nowrap">
                          {item.label}
                        </span>
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                        )}
                      </>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}

        {/* その他メニュー */}
        {otherMenuItems.length > 0 && (
          <>
            <div className="my-3 h-px bg-border/60" />
            {otherMenuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => itemClass(isActive)}
                title={!isOpen ? item.label : undefined}
              >
                {({ isActive }) => (
                  <>
                    {item.icon ? <item.icon className={iconClass(isActive)} /> : null}
                    {isOpen && (
                      <>
                        <span className="font-medium tracking-wide text-sm whitespace-nowrap">
                          {item.label}
                        </span>
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                        )}
                      </>
                    )}
                    {!isOpen && isActive && (
                      <div className="absolute left-0 w-1 h-8 bg-accent rounded-r-full" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* フッター */}
      {isOpen && (
        <div className="p-4 border-t border-border">
          <div className="text-xs text-text-dim text-center font-mono">v0.1.0 local</div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
