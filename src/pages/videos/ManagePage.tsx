import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/client';
import { fileSystem } from '../../services/fileSystem';
import { scanner } from '../../services/scanner';
import { FolderMount } from '../../types/domain';
import { RiFolderAddLine, RiHardDriveLine, RiRefreshLine, RiDeleteBinLine, RiCheckboxCircleLine, RiErrorWarningLine, RiFolderLine } from 'react-icons/ri';
import classNames from 'classnames';

const ManagePage: React.FC = () => {
  const mounts = useLiveQuery(() => db.mounts.toArray()) || [];
  const [selectedMountId, setSelectedMountId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedMount = mounts.find(m => m.id === selectedMountId);

  // Add new folder mount
  const handleAddFolder = async () => {
    setErrorMsg(null);
    try {
      if (!fileSystem.isSupported()) {
        throw new Error('Your browser does not support File System Access API. Please use Brave or Chrome.');
      }

      const dirHandle = await fileSystem.pickDirectory();
      
      // Check if already exists (simple check by name for now, ideally by resolving handles)
      const existing = mounts.find(m => m.name === dirHandle.name);
      if (existing) {
        // Just select it if exists
        setSelectedMountId(existing.id);
        return;
      }

      const newMount: FolderMount = {
        id: crypto.randomUUID(),
        name: dirHandle.name,
        pathKind: 'handle',
        dirHandle: dirHandle,
        includeSubdirs: true,
        exts: ['mp4', 'mkv', 'webm', 'mov'],
        ignoreGlobs: [],
        addedAt: Date.now()
      };

      await db.mounts.add(newMount);
      setSelectedMountId(newMount.id);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMsg(err.message);
      }
    }
  };

  // Run scan for selected mount
  const handleScan = async (mount: FolderMount) => {
    setIsScanning(true);
    setLastScanResult(null);
    setErrorMsg(null);

    try {
      const result = await scanner.scanMount(mount);
      setLastScanResult(`Scanned: ${result.added} added, ${result.updated} updated.`);
    } catch (err: any) {
      setErrorMsg(`Scan failed: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Remove mount
  const handleDeleteMount = async (id: string) => {
    if (confirm('Are you sure you want to remove this folder? Videos indexed from this folder will remain in the database until cleaned up.')) {
      await db.mounts.delete(id);
      if (selectedMountId === id) setSelectedMountId(null);
      // TODO: Option to clean up associated videos
    }
  };

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">Manage Library</h2>
          <p className="text-text-dim text-sm mt-1">Configure source folders and scan for local files.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2">
          <RiErrorWarningLine className="text-xl flex-shrink-0" />
          <span className="text-sm">{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Left Col: Mount List */}
        <div className="bg-bg-panel border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-bg-surface flex justify-between items-center">
            <span className="font-medium text-text-muted text-sm uppercase tracking-wider">Source Folders</span>
            <button 
              onClick={handleAddFolder}
              className="text-accent hover:text-accent-light p-1.5 hover:bg-accent/10 rounded transition-colors"
              title="Add Folder"
            >
              <RiFolderAddLine className="text-lg" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
            {mounts.length === 0 ? (
              <div className="text-center py-8 text-text-dim">
                <p className="text-sm mb-2">No folders added</p>
                <button 
                  onClick={handleAddFolder}
                  className="text-xs text-accent hover:underline"
                >
                  Add your first folder
                </button>
              </div>
            ) : (
              mounts.map(mount => (
                <button
                  key={mount.id}
                  onClick={() => setSelectedMountId(mount.id)}
                  className={classNames(
                    "w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 transition-all border",
                    selectedMountId === mount.id 
                      ? "bg-accent/10 border-accent/30 text-text-main shadow-sm" 
                      : "bg-transparent border-transparent text-text-muted hover:bg-bg-surface hover:text-text-main"
                  )}
                >
                  <div className={classNames(
                    "w-8 h-8 rounded-md flex items-center justify-center text-lg",
                    selectedMountId === mount.id ? "bg-accent text-white" : "bg-bg-surface text-text-dim"
                  )}>
                    <RiFolderLine />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{mount.name}</div>
                    <div className="text-[10px] text-text-dim truncate font-mono">
                      {mount.exts.join(', ')}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Col: Mount Details */}
        <div className="md:col-span-2 bg-bg-panel border border-border rounded-xl flex flex-col relative overflow-hidden">
          {selectedMount ? (
            <div className="flex-1 flex flex-col p-6 space-y-8">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-heading text-2xl font-bold flex items-center gap-2">
                    <RiHardDriveLine className="text-text-dim" />
                    {selectedMount.name}
                  </h3>
                  <div className="text-xs text-text-dim font-mono mt-1 px-1 bg-bg-surface inline-block rounded border border-border">
                    ID: {selectedMount.id.slice(0, 8)}...
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteMount(selectedMount.id)}
                  className="text-text-dim hover:text-red-400 p-2 hover:bg-red-400/10 rounded-lg transition-colors"
                  title="Remove Folder"
                >
                  <RiDeleteBinLine className="text-xl" />
                </button>
              </div>

              <div className="space-y-4 max-w-lg">
                <div className="space-y-2">
                  <label className="text-sm text-text-muted font-medium">Included Extensions</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedMount.exts.map(ext => (
                      <span key={ext} className="px-2 py-1 rounded bg-bg-surface border border-border text-xs text-text-dim font-mono">
                        .{ext}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 py-2">
                  <div className={classNames("w-4 h-4 rounded border flex items-center justify-center", selectedMount.includeSubdirs ? "bg-accent border-accent text-white" : "border-text-dim")}>
                    {selectedMount.includeSubdirs && <RiCheckboxCircleLine className="text-xs" />}
                  </div>
                  <span className="text-sm text-text-main">Include subdirectories recursively</span>
                </div>
              </div>

              <div className="border-t border-border pt-6 mt-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-text-main">Scan Folder</h4>
                    <p className="text-sm text-text-dim">Index video files from this directory.</p>
                  </div>
                  <button
                    onClick={() => handleScan(selectedMount)}
                    disabled={isScanning}
                    className={classNames(
                      "flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all shadow-lg",
                      isScanning 
                        ? "bg-bg-surface text-text-dim cursor-not-allowed" 
                        : "bg-accent hover:bg-accent/90 text-white shadow-accent/20 hover:shadow-accent/40"
                    )}
                  >
                    <RiRefreshLine className={classNames("text-lg", isScanning && "animate-spin")} />
                    {isScanning ? 'Scanning...' : 'Start Scan'}
                  </button>
                </div>
                
                {lastScanResult && (
                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded text-green-200 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                    <RiCheckboxCircleLine className="text-lg" />
                    {lastScanResult}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-text-dim p-8">
              <RiHardDriveLine className="text-6xl opacity-20 mb-4" />
              <p className="text-lg font-medium">No Folder Selected</p>
              <p className="text-sm opacity-60">Select a folder from the left to manage or scan.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ManagePage;
