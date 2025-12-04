import React from 'react';

const SettingsPage: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h2 className="font-heading text-2xl font-bold border-b border-border pb-4">Settings</h2>
      
      <div className="space-y-4">
        <h3 className="font-medium text-lg">Appearance</h3>
        <div className="bg-bg-panel p-4 rounded-lg border border-border text-text-muted">
          Settings options will go here.
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
