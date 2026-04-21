import React from 'react';
import { RiSearchLine } from 'react-icons/ri';
import { listControlFieldClassName } from './listControls';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  size?: 'md' | 'list';
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = '讀懃ｴ｢...',
  className,
  size = 'md',
}) => {
  const inputClassName =
    size === 'list'
      ? `${listControlFieldClassName} pr-10`
      : `block w-full bg-bg-panel border border-border text-text-main rounded-xl py-2.5 pl-10 pr-10
                   placeholder-text-dim focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50
                   transition-all duration-200 shadow-sm`;

  return (
    <div className={`relative group ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <RiSearchLine className="text-text-dim text-lg group-focus-within:text-accent transition-colors" />
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClassName}
        placeholder={placeholder}
      />
    </div>
  );
};

export default SearchBar;
