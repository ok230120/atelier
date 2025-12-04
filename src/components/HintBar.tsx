import React from 'react';

const HintBar: React.FC = () => {
  return (
    <div className="h-8 min-h-[2rem] bg-bg-surface border-t border-border px-4 flex items-center justify-between text-xs text-text-dim select-none">
      <div className="flex gap-4">
        <span>Ready</span>
      </div>
      <div className="flex gap-4 font-mono">
        <span className="flex items-center gap-1">
          <kbd className="bg-bg-panel px-1.5 py-0.5 rounded border border-border-light text-[10px]">?</kbd> Help
        </span>
      </div>
    </div>
  );
};

export default HintBar;
