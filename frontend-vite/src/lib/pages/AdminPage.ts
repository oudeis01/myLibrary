/**
 * @file lib/pages/AdminPage.ts
 * @brief Server administration page component
 */

import { BaseComponent } from '../core/BaseComponent';
import type { ComponentState } from '../core/types';
import { eventBus, Events } from '../core/EventBus';

interface AdminState extends ComponentState {
  scannerStatus: any;
  isLoading: boolean;
  showMonitoring: boolean;
  currentOperation: string | null;
  monitoringLogs: Array<{
    timestamp: string;
    level: 'info' | 'success' | 'warning' | 'error';
    message: string;
  }>;
}

/**
 * Admin page component for server administration
 */
export class AdminPage extends BaseComponent<AdminState> {
  constructor() {
    super({
      scannerStatus: { is_scanning: false, processed_books: 0, total_books: 0 },
      isLoading: false,
      showMonitoring: false,
      currentOperation: null,
      monitoringLogs: []
    });
  }

  render(): string {
    return `
      <div class="admin-container">
        <header class="admin-header">
          <h1>⚙️ Server Administration</h1>
          <div class="header-actions">
            ${this.state.showMonitoring ? 
              `<button id="hide-monitoring" class="back-btn">← Hide Monitor</button>` :
              ''
            }
            <button id="back-to-library" class="back-btn">← Back to Library</button>
          </div>
        </header>
        
        ${this.state.showMonitoring ? this.renderMonitoringSection() : this.renderAdminSections()}
        
        <div id="status" class="status"></div>
      </div>
    `;
  }

  private renderAdminSections(): string {
    return `
      <div class="admin-content">
        ${this.renderLibraryManagement()}
        ${this.renderDatabaseStatus()}
        ${this.renderServerStatus()}
      </div>
    `;
  }

  private renderMonitoringSection(): string {
    const operation = this.state.currentOperation || 'Operation';
    const status = this.state.scannerStatus;
    const progress = status.total_books > 0 ? 
      Math.round((status.processed_books / status.total_books) * 100) : 0;

    return `
      <div class="monitoring-content">
        <div class="monitoring-header">
          <h2>📊 ${operation} Monitor</h2>
          <button id="stop-operation" class="stop-btn" ${!status.is_scanning ? 'disabled' : ''}>
            ⏹ Stop Operation
          </button>
        </div>
        
        <div class="progress-section">
          <div class="progress-bar-container">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="progress-text">${progress}% Complete (${status.processed_books}/${status.total_books})</div>
          </div>
          
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Status</div>
              <div class="stat-value">${status.is_scanning ? 'Running' : 'Completed'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Processed</div>
              <div class="stat-value">${status.processed_books}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Orphaned Cleaned</div>
              <div class="stat-value">${status.orphaned_cleaned || 0}</div>
            </div>
          </div>
        </div>
        
        <div class="terminal-section">
          <h3>Operation Log</h3>
          <div class="terminal" id="terminal-log">
            ${this.state.monitoringLogs.map(log => `
              <div class="log-entry log-${log.level}">
                <span class="log-timestamp">${log.timestamp}</span>
                <span class="log-level">[${log.level.toUpperCase()}]</span>
                <span class="log-message">${log.message}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  private renderLibraryManagement(): string {
    return `
      <div class="admin-section">
        <h2>📂 Library Management</h2>
        <div class="admin-actions">
          <button id="library-scan-btn" class="admin-action-btn primary">
            <span class="btn-icon">🔍</span>
            <span class="btn-text">
              <strong>Library Scan</strong>
              <small>Find new books in the library directory</small>
            </span>
          </button>
          
          <button id="sync-scan-btn" class="admin-action-btn secondary">
            <span class="btn-icon">🔄</span>
            <span class="btn-text">
              <strong>Sync Scan</strong>
              <small>Full synchronization with cleanup</small>
            </span>
          </button>
          
          <button id="cleanup-btn" class="admin-action-btn warning">
            <span class="btn-icon">🧹</span>
            <span class="btn-text">
              <strong>Cleanup Orphaned</strong>
              <small>Remove database records for missing files</small>
            </span>
          </button>
        </div>
      </div>
    `;
  }

  private renderCacheManagement(): string {
    return `
      <div class="admin-section">
        <h2>💾 Cache Management</h2>
        <div class="admin-actions">
          <button id="clear-thumbnails-btn" class="admin-action-btn secondary">
            <span class="btn-icon">🖼️</span>
            <span class="btn-text">
              <strong>Clear Thumbnail Cache</strong>
              <small>Remove all cached thumbnail images</small>
            </span>
          </button>
          
          <button id="cache-stats-btn" class="admin-action-btn info">
            <span class="btn-icon">📊</span>
            <span class="btn-text">
              <strong>Cache Statistics</strong>
              <small>View cache usage and statistics</small>
            </span>
          </button>
        </div>
      </div>
    `;
  }

  private renderServerStatus(): string {
    const scannerStatus = this.state.scannerStatus;
    const statusText = scannerStatus.is_scanning ? 
      `Scanning... (${scannerStatus.processed_books}/${scannerStatus.total_books})` : 
      'Ready';

    return `
      <div class="admin-section">
        <h2>📊 Server Status</h2>
        <div class="status-grid">
          <div id="scanner-status" class="status-card">
            <h3>Scanner Status</h3>
            <div class="status-value">${statusText}</div>
          </div>
          <div id="cache-status" class="status-card">
            <h3>Cache Info</h3>
            <div class="status-value">
              ${this.state.cacheStats ? `${this.state.cacheStats.size} items` : 'Loading...'}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents(): void {
    // Navigation buttons
    this.addEventListener('#back-to-library', 'click', () => {
      eventBus.emit(Events.NAVIGATE, '/library');
    });

    this.addEventListener('#hide-monitoring', 'click', () => {
      this.setState({ showMonitoring: false, currentOperation: null });
    });

    // Library management operations
    this.addEventListener('#library-scan-btn', 'click', async () => {
      await this.startLibraryScan('library-scan');
    });

    this.addEventListener('#sync-scan-btn', 'click', async () => {
      await this.startLibraryScan('sync-scan');
    });

    this.addEventListener('#cleanup-btn', 'click', async () => {
      await this.startCleanupOperation();
    });


    // Monitoring operations
    this.addEventListener('#stop-operation', 'click', async () => {
      await this.stopCurrentOperation();
    });
  }

  protected onMounted(): void {
    this.updateAdminStatus();
    this.addAdminStyles();
  }

  /**
   * Add renderDatabaseStatus method
   */
  private renderDatabaseStatus(): string {
    return `
      <div class="admin-section">
        <h2>📊 Database Status</h2>
        <div class="status-grid">
          <div class="status-card">
            <h3>Total Books</h3>
            <div class="status-value">${this.state.scannerStatus.total_books || 0}</div>
          </div>
          <div class="status-card">
            <h3>Books Found</h3>
            <div class="status-value">${this.state.scannerStatus.books_found || 0}</div>
          </div>
          <div class="status-card">
            <h3>Orphaned Cleaned</h3>
            <div class="status-value">${this.state.scannerStatus.orphaned_cleaned || 0}</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Stop current operation
   */
  private async stopCurrentOperation(): Promise<void> {
    try {
      const token = localStorage.getItem('sessionToken');
      
      const response = await fetch('http://localhost:8080/api/library/scan-stop', {
        method: 'POST',
        headers: { 'X-Session-Token': token || '' }
      });

      if (response.ok) {
        this.addMonitoringLog('info', 'Stop signal sent to current operation');
        this.showStatus('Operation stop requested', 'info');
      } else {
        this.showStatus('Failed to stop operation', 'error');
      }
    } catch (error) {
      console.error('Stop operation error:', error);
      this.showStatus(`Error stopping operation: ${error}`, 'error');
    }
  }

  /**
   * Handle scan completion
   */
  private onScanCompleted(): void {
    this.addMonitoringLog('success', `${this.state.currentOperation} completed successfully`);
    this.showStatus(`${this.state.currentOperation} completed`, 'success');
    
    // Clear monitoring interval
    if ((this as any).monitoringInterval) {
      clearInterval((this as any).monitoringInterval);
    }

    // Update final status
    this.updateAdminStatus();
    
    // Emit books refresh to update library page
    eventBus.emit(Events.BOOKS_REFRESH);
  }

  /**
   * Start library scan operation
   */
  private async startLibraryScan(scanType: 'library-scan' | 'sync-scan'): Promise<void> {
    try {
      const token = localStorage.getItem('sessionToken');
      const endpoint = scanType === 'sync-scan' ? '/api/library/sync-scan' : '/api/library/scan';
      
      this.showStatus('Starting scan operation...', 'info');
      
      const response = await fetch(`http://localhost:8080${endpoint}`, {
        method: 'POST',
        headers: { 'X-Session-Token': token || '' }
      });

      if (response.ok) {
        // Show monitoring within admin page
        this.setState({ 
          showMonitoring: true, 
          currentOperation: scanType === 'sync-scan' ? 'Sync Scan' : 'Library Scan',
          monitoringLogs: []
        });
        this.addMonitoringLog('info', `${this.state.currentOperation} started successfully`);
        this.startMonitoringPolling();
      } else {
        const error = await response.text();
        this.showStatus(`Failed to start scan: ${error}`, 'error');
      }
    } catch (error) {
      console.error('Scan start error:', error);
      this.showStatus(`Error starting scan: ${error}`, 'error');
    }
  }

  /**
   * Start cleanup operation
   */
  private async startCleanupOperation(): Promise<void> {
    try {
      const token = localStorage.getItem('sessionToken');
      
      this.showStatus('Starting cleanup operation...', 'info');
      
      const response = await fetch('http://localhost:8080/api/library/cleanup-orphaned', {
        method: 'POST',
        headers: { 'X-Session-Token': token || '' }
      });

      if (response.ok) {
        // Show monitoring within admin page
        this.setState({ 
          showMonitoring: true, 
          currentOperation: 'Database Cleanup',
          monitoringLogs: []
        });
        this.addMonitoringLog('info', 'Database cleanup started successfully');
        this.startMonitoringPolling();
      } else {
        const error = await response.text();
        this.showStatus(`Failed to start cleanup: ${error}`, 'error');
      }
    } catch (error) {
      console.error('Cleanup start error:', error);
      this.showStatus(`Error starting cleanup: ${error}`, 'error');
    }
  }

  /**
   * Clear thumbnail cache
   */
  private async clearThumbnailCache(): Promise<void> {
    try {
      const token = localStorage.getItem('sessionToken');
      
      const button = this.querySelector('#clear-thumbnails-btn') as HTMLButtonElement;
      const originalText = button.innerHTML;
      button.innerHTML = '<span class="btn-icon">⠋</span><span class="btn-text"><strong>Clearing...</strong></span>';
      button.disabled = true;

      const response = await fetch('http://localhost:8080/api/cache/clear-thumbnails', {
        method: 'POST',
        headers: { 'X-Session-Token': token || '' }
      });

      if (response.ok) {
        const result = await response.json();
        this.showStatus(`Thumbnail cache cleared: ${result.message || 'Success'}`, 'success');
      } else {
        const error = await response.text();
        this.showStatus(`Failed to clear cache: ${error}`, 'error');
      }

      button.innerHTML = originalText;
      button.disabled = false;
      
    } catch (error) {
      console.error('Cache clear error:', error);
      this.showStatus(`Error clearing cache: ${error}`, 'error');
      
      const button = this.querySelector('#clear-thumbnails-btn') as HTMLButtonElement;
      button.disabled = false;
    }
  }

  /**
   * Show cache statistics
   */
  private async showCacheStats(): Promise<void> {
    try {
      const token = localStorage.getItem('sessionToken');
      
      const response = await fetch('http://localhost:8080/api/cache/stats', {
        headers: { 'X-Session-Token': token || '' }
      });

      if (response.ok) {
        const stats = await response.json();
        this.setState({ cacheStats: stats });
        this.showStatus(`Cache stats: ${JSON.stringify(stats, null, 2)}`, 'info');
      } else {
        this.showStatus('Failed to load cache stats', 'error');
      }
    } catch (error) {
      console.error('Cache stats error:', error);
      this.showStatus(`Error loading cache stats: ${error}`, 'error');
    }
  }

  /**
   * Update admin status information
   */
  private async updateAdminStatus(): Promise<void> {
    try {
      const token = localStorage.getItem('sessionToken');
      
      // Get scanner status
      const scannerResponse = await fetch('http://localhost:8080/api/library/scan-status', {
        headers: { 'X-Session-Token': token || '' }
      });

      if (scannerResponse.ok) {
        const scannerStatus = await scannerResponse.json();
        this.setState({ scannerStatus });
      }

    } catch (error) {
      console.error('Status update error:', error);
    }
  }

  /**
   * Start monitoring polling for real-time updates
   */
  private startMonitoringPolling(): void {
    const pollInterval = setInterval(async () => {
      await this.updateScanStatus();
      
      // Stop polling when scan is complete
      if (!this.state.scannerStatus.is_scanning) {
        clearInterval(pollInterval);
        this.onScanCompleted();
      }
    }, 1000);

    // Store interval ID for cleanup
    (this as any).monitoringInterval = pollInterval;
  }

  /**
   * Update scan status during monitoring
   */
  private async updateScanStatus(): Promise<void> {
    try {
      const token = localStorage.getItem('sessionToken');
      const response = await fetch('http://localhost:8080/api/library/scan-status', {
        headers: { 'X-Session-Token': token || '' }
      });

      if (response.ok) {
        const status = await response.json();
        const oldStatus = this.state.scannerStatus;
        
        // Update status
        this.setState({ scannerStatus: status }, false);

        // Add progress log if changed
        if (status.processed_books > oldStatus.processed_books) {
          this.addMonitoringLog('info', 
            `Progress: ${status.processed_books}/${status.total_books} books processed`);
        }

        // Re-render just the monitoring section
        if (this.state.showMonitoring) {
          this.updateMonitoringDisplay();
        }
      }
    } catch (error) {
      console.error('Scan status update error:', error);
    }
  }


  /**
   * Stop current operation
   */

  /**
   * Add log entry to monitoring logs
   */
  private addMonitoringLog(level: 'info' | 'success' | 'warning' | 'error', message: string): void {
    const timestamp = new Date().toISOString().substring(11, 23); // HH:mm:ss.SSS
    const newLog = { timestamp, level, message };
    
    const updatedLogs = [...this.state.monitoringLogs, newLog];
    
    // Keep only last 1000 logs for performance
    if (updatedLogs.length > 1000) {
      updatedLogs.shift();
    }
    
    this.setState({ monitoringLogs: updatedLogs }, false);
    
    // Auto-scroll terminal if showing monitoring
    if (this.state.showMonitoring) {
      setTimeout(() => {
        const terminal = this.querySelector('#terminal-log');
        if (terminal) {
          terminal.scrollTop = terminal.scrollHeight;
        }
      }, 10);
    }
  }

  /**
   * Update monitoring display without full re-render
   */
  private updateMonitoringDisplay(): void {
    if (!this.state.showMonitoring) return;

    const status = this.state.scannerStatus;
    const progress = status.total_books > 0 ? 
      Math.round((status.processed_books / status.total_books) * 100) : 0;

    // Update progress bar
    const progressFill = this.querySelector('.progress-fill') as HTMLElement;
    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }

    // Update progress text
    const progressText = this.querySelector('.progress-text') as HTMLElement;
    if (progressText) {
      progressText.textContent = `${progress}% Complete (${status.processed_books}/${status.total_books})`;
    }

    // Update status values
    const statusValue = this.querySelector('.stat-card .stat-value') as HTMLElement;
    if (statusValue) {
      statusValue.textContent = status.is_scanning ? 'Running' : 'Completed';
    }

    // Update stop button
    const stopBtn = this.querySelector('#stop-operation') as HTMLButtonElement;
    if (stopBtn) {
      stopBtn.disabled = !status.is_scanning;
    }
  }

  /**
   * Show status message
   */
  private showStatus(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
    eventBus.emit(Events.STATUS_MESSAGE, { message, type });
    
    const statusDiv = this.querySelector('#status');
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = `status ${type}`;
    }
  }

  /**
   * Add admin-specific styles
   */
  private addAdminStyles(): void {
    const existingStyles = document.querySelector('#admin-styles');
    if (existingStyles) return;

    const style = document.createElement('style');
    style.id = 'admin-styles';
    style.textContent = `
      .admin-container {
        min-height: 100vh;
        background: var(--bg-primary);
        color: var(--text-primary);
      }

      .admin-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 2rem;
        border-bottom: 1px solid var(--border);
      }

      .admin-header h1 {
        margin: 0;
        font-size: 2rem;
      }

      .back-btn {
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        color: var(--text-primary);
        padding: 0.5rem 1rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .back-btn:hover {
        background: var(--bg-tertiary);
      }

      .admin-content {
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;
      }

      .admin-section {
        margin-bottom: 3rem;
      }

      .admin-section h2 {
        margin-bottom: 1.5rem;
        color: var(--text-secondary);
        font-size: 1.5rem;
      }

      .admin-actions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1rem;
      }

      .admin-action-btn {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1.5rem;
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        color: var(--text-primary);
        cursor: pointer;
        transition: all 0.2s;
        text-align: left;
      }

      .admin-action-btn:hover:not(:disabled) {
        background: var(--bg-tertiary);
        border-color: var(--accent);
      }

      .admin-action-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .admin-action-btn.primary { border-color: var(--accent); }
      .admin-action-btn.secondary { border-color: var(--text-muted); }
      .admin-action-btn.warning { border-color: var(--error); }
      .admin-action-btn.info { border-color: var(--success); }

      .btn-icon {
        font-size: 1.5rem;
        flex-shrink: 0;
      }

      .btn-text {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .btn-text strong {
        font-size: 1.1rem;
        color: var(--text-primary);
      }

      .btn-text small {
        color: var(--text-muted);
        font-size: 0.9rem;
      }

      .status-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
      }

      .status-card {
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        padding: 1.5rem;
      }

      .status-card h3 {
        margin: 0 0 1rem 0;
        color: var(--text-secondary);
        font-size: 1rem;
      }

      .status-value {
        font-size: 1.2rem;
        color: var(--text-primary);
        font-weight: 500;
      }
    `;
    document.head.appendChild(style);
  }


  /**
   * Cleanup when component unmounts
   */
  protected onBeforeUnmount(): void {
    if ((this as any).monitoringInterval) {
      clearInterval((this as any).monitoringInterval);
    }
  }
}