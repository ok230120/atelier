import React from 'react';
import { useLocation } from 'react-router-dom';
import { pageRegistry } from '../pages/registry';
import { RiSearchLine, RiNotification3Line } from 'react-icons/ri';

const Topbar: React.FC = () => {
  const location = useLocation();
  
  // Find current page label based on path matching (simplified)
  const currentPage = pageRegistry.find(p => {
    if (p.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(p.path);
  });

  const title = currentPage?.label || 'Atelier';

  return (
    <header className="h-16 min-h-[4rem] px-8 border-b border-border bg-bg/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h2 className="font-heading text-xl text-text-main tracking-wide">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-6">
        {/* Placeholder for global search */}
        <div className="relative group">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim group-hover:text-text-muted transition-colors" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="bg-bg-panel border border-border rounded-full py-1.5 pl-10 pr-4 text-sm text-text-main focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all w-64 placeholder-text-dim"
            disabled // TODO: Implement global search
          />
        </div>
        
        <button className="text-text-muted hover:text-text-main transition-colors relative">
          <RiNotification3Line className="text-xl" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full opacity-75"></span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;
