import React from 'react';

const ManagePage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-bg-panel border border-border rounded-xl p-8">
        <h2 className="font-heading text-xl font-bold mb-4">Mount Folders</h2>
        <p className="text-text-muted mb-6">Add local folders to scan for videos.</p>
        <button className="px-4 py-2 bg-accent/10 text-accent border border-accent/20 rounded hover:bg-accent/20 transition-colors">
          + Add Folder
        </button>
      </div>
    </div>
  );
};

export default ManagePage;
