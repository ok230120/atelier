import React from 'react';
import { NavLink } from 'react-router-dom';
import classNames from 'classnames';
import { pageRegistry } from '../pages/registry';

const Sidebar: React.FC = () => {
  const menuItems = pageRegistry.filter(p => p.isMenu);

  return (
    <aside className="w-64 h-full bg-bg-surface border-r border-border flex flex-col z-20 shadow-xl">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <h1 className="font-heading font-bold text-2xl tracking-tight text-white">
          atelier<span className="text-accent">.</span>
        </h1>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              classNames(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive 
                  ? "bg-bg-panel text-accent shadow-sm border border-border-light" 
                  : "text-text-muted hover:text-text-main hover:bg-bg-panel/50"
              )
            }
          >
            {({ isActive }) => (
              <>
                {item.icon && (
                  <item.icon 
                    className={classNames(
                      "text-xl transition-colors",
                      isActive ? "text-accent" : "text-text-dim group-hover:text-text-main"
                    )} 
                  />
                )}
                <span className="font-medium tracking-wide text-sm">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="text-xs text-text-dim text-center font-mono">
          v0.1.0 local
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
