// FILE: src/components/Sidebar.tsx
import { NavLink, useLocation } from 'react-router-dom';
import classNames from 'classnames';
import { Menu } from 'lucide-react';
import { pageRegistry } from '../pages/registry';

interface SidebarProps {
  isOverlay?: boolean;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
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
  const inImageArea = pathname.startsWith('/images');

  const menuItems = pageRegistry.filter((page) => page.isMenu);

  const homePath = '/';
  const libraryPath = '/videos';
  const novelsPath = '/novels';
  const imagesPath = '/images';

  const videoSubPaths = ['/favorites', '/manage', '/settings'];
  const novelSubPaths = ['/novels/favorites', '/novels/manage'];
  const imageSubPaths = [
    '/images/tagging',
    '/images/tagging/completed',
    '/images/import',
    '/images/tags',
    '/images/manage',
  ];

  const homeItem = menuItems.find((page) => page.path === homePath);
  const libraryItem = menuItems.find((page) => page.path === libraryPath);
  const novelsItem = menuItems.find((page) => page.path === novelsPath);
  const imagesItem = menuItems.find((page) => page.path === imagesPath);

  const videoSubItems = videoSubPaths
    .map((path) => menuItems.find((page) => page.path === path))
    .filter(Boolean);
  const novelSubItems = novelSubPaths
    .map((path) => menuItems.find((page) => page.path === path))
    .filter(Boolean);
  const imageSubItems = imageSubPaths
    .map((path) => menuItems.find((page) => page.path === path))
    .filter(Boolean);

  const otherMenuItems = menuItems.filter(
    (page) =>
      page.path !== homePath &&
      page.path !== libraryPath &&
      page.path !== novelsPath &&
      page.path !== imagesPath &&
      !videoSubPaths.includes(page.path) &&
      !novelSubPaths.includes(page.path) &&
      !imageSubPaths.includes(page.path),
  );

  const itemClass = (isActive: boolean) =>
    classNames(
      'relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 group',
      isActive
        ? 'border border-border-light bg-bg-panel text-accent shadow-sm'
        : 'text-text-muted hover:bg-bg-panel/50 hover:text-text-main',
    );

  const iconClass = (isActive: boolean, isSubItem = false) =>
    classNames(
      'relative z-10 transition-colors transition-transform duration-200',
      isActive ? 'text-accent' : 'text-text-dim group-hover:text-text-main',
      !isOpen && isSubItem ? 'text-lg' : 'text-xl',
      !isOpen && isSubItem && (isActive ? 'opacity-100 scale-100' : 'opacity-80 scale-90'),
      !isOpen && isSubItem && !isActive && 'group-hover:opacity-95 group-hover:scale-95',
    );

  const renderItem = (
    item: (typeof menuItems)[number] | undefined,
    active: boolean,
    isSubItem = false,
    titleFallback = '',
  ) => {
    if (!item) return null;

    return (
      <>
        {item.icon ? <item.icon className={iconClass(active, isSubItem)} /> : null}
        {isOpen && (
          <>
            <span className="whitespace-nowrap text-sm font-medium tracking-wide">{item.label}</span>
            {active && (
              <div className="ml-auto h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            )}
          </>
        )}
        {!isOpen && active && <div className="absolute left-0 h-8 w-1 rounded-r-full bg-accent" />}
        {!isOpen && isSubItem && !active && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-2 top-1/2 h-8 w-[2px] -translate-y-1/2 rounded-full bg-border/60 transition-colors group-hover:bg-border/90"
            title={titleFallback}
          />
        )}
      </>
    );
  };

  return (
    <aside
      className={classNames(
        'flex h-full flex-col border-r border-border bg-bg-surface shadow-xl transition-all duration-300 ease-in-out',
        isOpen ? 'w-64' : 'w-[72px]',
        isOverlay ? 'fixed left-0 top-0 z-50' : 'z-20',
      )}
    >
      <div className="flex h-16 items-center border-b border-border px-4">
        <button
          onClick={() => onToggle?.(!isOpen)}
          className="mr-2 rounded-lg p-2 transition-colors hover:bg-bg-panel/50"
          aria-label="Toggle sidebar"
        >
          <Menu className="text-xl text-text-muted" />
        </button>

        {isOpen && (
          <h1 className="font-heading text-2xl font-bold tracking-tight text-white">
            atelier<span className="text-accent">.</span>
          </h1>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
        <NavLink
          to={homePath}
          end
          className={({ isActive }) => itemClass(isActive)}
          title={!isOpen ? homeItem?.label ?? 'Home' : undefined}
        >
          {({ isActive }) => renderItem(homeItem, isActive, false, 'Home')}
        </NavLink>

        <NavLink
          to={libraryPath}
          className={({ isActive }) =>
            classNames(itemClass(isActive || inVideoArea), !isOpen && inVideoArea && 'border border-border-light bg-bg-panel/20')
          }
          title={!isOpen ? libraryItem?.label ?? 'Library' : undefined}
        >
          {({ isActive }) => renderItem(libraryItem, isActive || inVideoArea, false, 'Library')}
        </NavLink>

        {inVideoArea && videoSubItems.length > 0 && (
          <div className={classNames(isOpen ? 'ml-3 border-l border-border/50 pl-3' : '', 'mt-1 space-y-1')}>
            {videoSubItems.map((item) => (
              <NavLink
                key={item!.path}
                to={item!.path}
                className={({ isActive }) => classNames(itemClass(isActive), 'py-2')}
                title={!isOpen ? item!.label : undefined}
              >
                {({ isActive }) => renderItem(item, isActive, true, item!.label)}
              </NavLink>
            ))}
          </div>
        )}

        <NavLink
          to={novelsPath}
          className={({ isActive }) =>
            classNames(itemClass(isActive || inNovelArea), !isOpen && inNovelArea && 'border border-border-light bg-bg-panel/20')
          }
          title={!isOpen ? novelsItem?.label ?? 'Novels' : undefined}
        >
          {({ isActive }) => renderItem(novelsItem, isActive || inNovelArea, false, 'Novels')}
        </NavLink>

        {inNovelArea && novelSubItems.length > 0 && (
          <div className={classNames(isOpen ? 'ml-3 border-l border-border/50 pl-3' : '', 'mt-1 space-y-1')}>
            {novelSubItems.map((item) => (
              <NavLink
                key={item!.path}
                to={item!.path}
                className={({ isActive }) => classNames(itemClass(isActive), 'py-2')}
                title={!isOpen ? item!.label : undefined}
              >
                {({ isActive }) => renderItem(item, isActive, true, item!.label)}
              </NavLink>
            ))}
          </div>
        )}

        <NavLink
          to={imagesPath}
          className={({ isActive }) =>
            classNames(itemClass(isActive || inImageArea), !isOpen && inImageArea && 'border border-border-light bg-bg-panel/20')
          }
          title={!isOpen ? imagesItem?.label ?? 'Images' : undefined}
        >
          {({ isActive }) => renderItem(imagesItem, isActive || inImageArea, false, 'Images')}
        </NavLink>

        {inImageArea && imageSubItems.length > 0 && (
          <div className={classNames(isOpen ? 'ml-3 border-l border-border/50 pl-3' : '', 'mt-1 space-y-1')}>
            {imageSubItems.map((item) => (
              <NavLink
                key={item!.path}
                to={item!.path}
                className={({ isActive }) => classNames(itemClass(isActive), 'py-2')}
                title={!isOpen ? item!.label : undefined}
              >
                {({ isActive }) => renderItem(item, isActive, true, item!.label)}
              </NavLink>
            ))}
          </div>
        )}

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
                {({ isActive }) => renderItem(item, isActive, false, item.label)}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {isOpen && (
        <div className="border-t border-border p-4">
          <div className="text-center font-mono text-xs text-text-dim">v0.1.0 local</div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
