import React from 'react';
import { RiSearchLine, RiFilter3Line } from 'react-icons/ri';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  value, 
  onChange, 
  placeholder = "Search videos...", 
  className 
}) => {
  return (
    <div className={`relative group ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <RiSearchLine className="text-text-dim text-lg group-focus-within:text-accent transition-colors" />
      </div>
      
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full bg-bg-panel border border-border text-text-main rounded-xl py-2.5 pl-10 pr-10 
                   placeholder-text-dim focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 
                   transition-all duration-200 shadow-sm"
        placeholder={placeholder}
      />
      
      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
        {/* Future filter toggle trigger */}
        <button className="text-text-dim hover:text-text-main transition-colors p-1 rounded hover:bg-bg-surface">
          <RiFilter3Line />
        </button>
      </div>
    </div>
  );
};

export default SearchBar;