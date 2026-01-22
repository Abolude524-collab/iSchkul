import React, { useState, useEffect } from 'react';
import { useOfflineStatus, useSyncListener } from '../hooks/useOfflineSupport';
import { fullSync } from '../services/syncManager';
import { getUnsyncedActions } from '../services/indexedDB';

interface SyncStatusProps {
  token?: string;
  onSyncComplete?: () => void;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ token, onSyncComplete }) => {
  const { isOnline } = useOfflineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingItems, setPendingItems] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');
  const [showStatus, setShowStatus] = useState(false);

  /**
   * Check for unsynced items
   */
  const checkPendingItems = async () => {
    try {
      const actions = await getUnsyncedActions();
      setPendingItems(actions.length);
    } catch (error) {
      console.error('Error checking pending items:', error);
    }
  };

  /**
   * Perform sync
   */
  const handleSync = async () => {
    if (!token || !isOnline) return;

    setIsSyncing(true);
    setSyncMessage('Syncing your offline work...');

    try {
      const result = await fullSync(token);

      if (result.success) {
        setSyncMessage(
          `✓ Successfully synced ${result.synced} item${result.synced !== 1 ? 's' : ''}`
        );
        setPendingItems(0);
        if (onSyncComplete) onSyncComplete();
      } else {
        setSyncMessage(
          `Synced ${result.synced} items (${result.failed} failed)`
        );
      }

      // Hide message after 3 seconds
      setTimeout(() => setSyncMessage(''), 3000);
    } catch (error: any) {
      setSyncMessage(`Sync error: ${error.message}`);
      setTimeout(() => setSyncMessage(''), 3000);
    } finally {
      setIsSyncing(false);
      checkPendingItems();
    }
  };

  /**
   * Auto-sync when coming online
   */
  useSyncListener(async () => {
    await checkPendingItems();
    if (token) {
      await handleSync();
    }
  });

  /**
   * Check pending on mount and when online status changes
   */
  useEffect(() => {
    checkPendingItems();
  }, [isOnline]);

  return (
    <div className="sync-status-container">
      {/* Status Button */}
      <button
        onClick={() => setShowStatus(!showStatus)}
        className={`sync-status-button ${!isOnline ? 'offline' : 'online'}`}
        title={isOnline ? 'Online' : 'Offline'}
      >
        <div className="status-indicator">
          {!isOnline ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="1" />
                <path d="M12 2v6" />
                <path d="M4.22 4.22l4.24 4.24" />
                <path d="M2 12h6" />
                <path d="M4.22 19.78l4.24-4.24" />
                <path d="M12 16v6" />
                <path d="M19.78 19.78l-4.24-4.24" />
                <path d="M22 12h-6" />
                <path d="M19.78 4.22l-4.24 4.24" />
              </svg>
              <span>Offline</span>
            </>
          ) : pendingItems > 0 ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span>Pending: {pendingItems}</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <span>Synced</span>
            </>
          )}
        </div>
      </button>

      {/* Status Panel */}
      {showStatus && (
        <div className="sync-status-panel">
          <div className="panel-header">
            <h3>Sync Status</h3>
            <button
              className="close-button"
              onClick={() => setShowStatus(false)}
            >
              ✕
            </button>
          </div>

          <div className="panel-content">
            <div className="status-item">
              <span className="label">Connection:</span>
              <span className={`value ${isOnline ? 'online' : 'offline'}`}>
                {isOnline ? '🟢 Online' : '🔴 Offline'}
              </span>
            </div>

            {pendingItems > 0 && (
              <div className="status-item">
                <span className="label">Pending Sync:</span>
                <span className="value">{pendingItems} item{pendingItems !== 1 ? 's' : ''}</span>
              </div>
            )}

            {syncMessage && (
              <div className="sync-message">
                {syncMessage}
              </div>
            )}

            {isOnline && pendingItems > 0 && !isSyncing && (
              <button
                onClick={handleSync}
                className="sync-button"
                disabled={isSyncing}
              >
                Sync Now
              </button>
            )}

            {isSyncing && (
              <div className="syncing-indicator">
                <div className="spinner" />
                <span>Syncing...</span>
              </div>
            )}

            {isOnline && pendingItems === 0 && !isSyncing && (
              <div className="info-message">
                ✓ Everything is synced
              </div>
            )}

            {!isOnline && (
              <div className="info-message warning">
                ⚠ You're offline. Your work will sync when online.
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .sync-status-container {
          position: relative;
        }

        .sync-status-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.1);
          color: white;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s;
          backdrop-filter: blur(4px);
        }

        .sync-status-button:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .sync-status-button.offline {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
        }

        .sync-status-button.online {
          color: white;
        }

        .sync-status-button.online svg {
          color: #ade9c1;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .sync-status-panel {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 8px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          min-width: 280px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }

        .close-button {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          color: #6b7280;
        }

        .panel-content {
          padding: 12px 16px;
        }

        .status-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 13px;
        }

        .status-item .label {
          color: #6b7280;
          font-weight: 500;
        }

        .status-item .value {
          font-weight: 600;
        }

        .status-item .value.online {
          color: #059669;
        }

        .status-item .value.offline {
          color: #dc2626;
        }

        .sync-message {
          padding: 8px 12px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 4px;
          font-size: 12px;
          color: #166534;
          margin-bottom: 12px;
        }

        .info-message {
          padding: 8px 12px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 4px;
          font-size: 12px;
          color: #166534;
          text-align: center;
        }

        .info-message.warning {
          background: #fef3c7;
          border-color: #fde68a;
          color: #92400e;
        }

        .sync-button {
          width: 100%;
          padding: 8px 12px;
          background: #6366f1;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .sync-button:hover:not(:disabled) {
          background: #4f46e5;
        }

        .sync-button:disabled {
          background: #d1d5db;
          cursor: not-allowed;
        }

        .syncing-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px;
          font-size: 12px;
          color: #6366f1;
        }

        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid #e5e7eb;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default SyncStatus;
