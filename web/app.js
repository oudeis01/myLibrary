/**
 * @file app.js
 * @brief Frontend JavaScript for MyLibrary web interface
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-25
 */

// Global variables
let currentUser = null;
let sessionToken = null;
let currentBooks = [];
let deferredPrompt = null; // For PWA install prompt

// API base URL (adjust if needed)
const API_BASE = '/api';

/**
 * Initialize the application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    // Register service worker for PWA functionality
    registerServiceWorker();
    
    // Set up PWA install prompt
    setupPWAInstall();
    
    // Check if user is already logged in
    sessionToken = localStorage.getItem('sessionToken');
    currentUser = localStorage.getItem('currentUser');
    
    if (sessionToken && currentUser) {
        showMainApp();
        loadBooks();
    }
    
    // Set up form event listeners
    setupEventListeners();
    
    // Set up offline/online detection
    setupNetworkDetection();
});

/**
 * Register service worker for PWA functionality
 */
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered successfully:', registration);
            
            // Listen for service worker updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New service worker available, show update notification
                        showUpdateAvailable();
                    }
                });
            });
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    }
}

/**
 * Set up PWA install prompt
 */
function setupPWAInstall() {
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (event) => {
        console.log('PWA install prompt available');
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        event.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = event;
        // Show install button or notification
        showPWAInstallOption();
    });
    
    // Listen for app installed event
    window.addEventListener('appinstalled', (event) => {
        console.log('PWA was installed');
        hidePWAInstallOption();
        showSuccessMessage('MyLibrary가 홈 화면에 추가되었습니다!');
    });
}

/**
 * Show PWA install option to user
 */
function showPWAInstallOption() {
    // Create install button if it doesn't exist
    if (!document.getElementById('pwaInstallBtn')) {
        const installBtn = document.createElement('button');
        installBtn.id = 'pwaInstallBtn';
        installBtn.textContent = '📱 앱으로 설치';
        installBtn.className = 'btn btn-secondary';
        installBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            padding: 10px 15px;
            font-size: 14px;
            border-radius: 25px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        installBtn.onclick = installPWA;
        document.body.appendChild(installBtn);
    }
}

/**
 * Hide PWA install option
 */
function hidePWAInstallOption() {
    const installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
        installBtn.remove();
    }
}

/**
 * Install PWA when user clicks install button
 */
async function installPWA() {
    if (deferredPrompt) {
        // Show the install prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);
        
        // Clear the deferredPrompt for next time
        deferredPrompt = null;
        hidePWAInstallOption();
    }
}

/**
 * Set up network detection for offline/online status
 */
function setupNetworkDetection() {
    // Update UI based on initial network status
    updateNetworkStatus();
    
    // Listen for network status changes
    window.addEventListener('online', () => {
        console.log('Network: Online');
        updateNetworkStatus();
        showSuccessMessage('인터넷 연결이 복구되었습니다!');
        // Sync any pending data
        syncPendingData();
    });
    
    window.addEventListener('offline', () => {
        console.log('Network: Offline');
        updateNetworkStatus();
        showErrorMessage('오프라인 상태입니다. 일부 기능이 제한될 수 있습니다.');
    });
}

/**
 * Update UI based on network status
 */
function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    const statusIndicator = document.getElementById('networkStatus');
    
    if (!statusIndicator) {
        // Create network status indicator
        const indicator = document.createElement('div');
        indicator.id = 'networkStatus';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: 600;
            z-index: 1001;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(indicator);
    }
    
    const indicator = document.getElementById('networkStatus');
    if (isOnline) {
        indicator.textContent = '🟢 온라인';
        indicator.style.backgroundColor = '#d4edda';
        indicator.style.color = '#155724';
    } else {
        indicator.textContent = '🔴 오프라인';
        indicator.style.backgroundColor = '#f8d7da';
        indicator.style.color = '#721c24';
    }
}

/**
 * Sync pending data when connection is restored
 */
async function syncPendingData() {
    // Check for pending progress updates in localStorage
    const pendingUpdates = JSON.parse(localStorage.getItem('pendingProgressUpdates') || '[]');
    
    if (pendingUpdates.length > 0) {
        console.log(`Syncing ${pendingUpdates.length} pending progress updates`);
        
        for (const update of pendingUpdates) {
            try {
                await fetch(`${API_BASE}/books/${update.bookId}/progress`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Token': sessionToken
                    },
                    body: JSON.stringify(update.progressData)
                });
                console.log(`Synced progress for book ${update.bookId}`);
            } catch (error) {
                console.error(`Failed to sync progress for book ${update.bookId}:`, error);
            }
        }
        
        // Clear pending updates after sync
        localStorage.removeItem('pendingProgressUpdates');
        showSuccessMessage(`${pendingUpdates.length}개의 진행률 업데이트가 동기화되었습니다!`);
        
        // Refresh books list
        loadBooks();
    }
}

/**
 * Show notification about available app update
 */
function showUpdateAvailable() {
    const updateNotification = document.createElement('div');
    updateNotification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: #667eea;
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        max-width: 300px;
    `;
    updateNotification.innerHTML = `
        <div style="margin-bottom: 10px;">새로운 업데이트가 있습니다!</div>
        <button onclick="updateApp()" style="background: white; color: #667eea; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-right: 10px;">업데이트</button>
        <button onclick="this.parentElement.remove()" style="background: transparent; color: white; border: 1px solid white; padding: 5px 10px; border-radius: 5px; cursor: pointer;">나중에</button>
    `;
    document.body.appendChild(updateNotification);
}

/**
 * Update the app when user chooses to update
 */
function updateApp() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
            if (registration && registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
            }
        });
    }
}

/**
 * Set up all event listeners for forms and buttons
 */
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Register form
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    
    // Upload form
    document.getElementById('uploadForm').addEventListener('submit', handleUpload);
    
    // File input change event
    document.getElementById('bookFile').addEventListener('change', handleFileSelect);
}

/**
 * Switch between login and register tabs
 * @param {string} tab - Tab name ('login' or 'register')
 */
function switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tab + 'Tab').classList.add('active');
    
    // Clear messages
    hideMessages();
}

/**
 * Switch between main application tabs
 * @param {string} tab - Tab name ('books' or 'upload')
 */
function switchMainTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tab + 'Tab').classList.add('active');
    
    // Load books when switching to books tab
    if (tab === 'books') {
        loadBooks();
    }
}

/**
 * Handle user login
 * @param {Event} event - Form submit event
 */
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            sessionToken = data.data.session_token;
            currentUser = data.data.username;
            
            // Store in localStorage
            localStorage.setItem('sessionToken', sessionToken);
            localStorage.setItem('currentUser', currentUser);
            
            showSuccessMessage('로그인 성공!');
            setTimeout(() => {
                showMainApp();
                loadBooks();
            }, 1000);
        } else {
            showErrorMessage(data.error || '로그인에 실패했습니다.');
        }
    } catch (error) {
        showErrorMessage('서버 연결에 실패했습니다.');
        console.error('Login error:', error);
    }
}

/**
 * Handle user registration
 * @param {Event} event - Form submit event
 */
async function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validate password confirmation
    if (password !== confirmPassword) {
        showErrorMessage('비밀번호가 일치하지 않습니다.');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccessMessage('회원가입이 완료되었습니다. 로그인해주세요.');
            
            // Switch to login tab
            setTimeout(() => {
                switchTab('login');
                document.getElementById('loginUsername').value = username;
            }, 1500);
        } else {
            showErrorMessage(data.error || '회원가입에 실패했습니다.');
        }
    } catch (error) {
        showErrorMessage('서버 연결에 실패했습니다.');
        console.error('Register error:', error);
    }
}

/**
 * Handle file upload
 * @param {Event} event - Form submit event
 */
async function handleUpload(event) {
    event.preventDefault();
    
    const fileInput = document.getElementById('bookFile');
    const titleInput = document.getElementById('bookTitle');
    const authorInput = document.getElementById('bookAuthor');
    
    if (!fileInput.files[0]) {
        showErrorMessage('파일을 선택해주세요.');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    if (titleInput.value.trim()) {
        formData.append('title', titleInput.value.trim());
    }
    
    if (authorInput.value.trim()) {
        formData.append('author', authorInput.value.trim());
    }
    
    // Show upload progress
    document.getElementById('uploadProgress').style.display = 'block';
    
    try {
        const response = await fetch(`${API_BASE}/books/upload`, {
            method: 'POST',
            headers: {
                'X-Session-Token': sessionToken
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccessMessage('도서가 성공적으로 업로드되었습니다!');
            
            // Clear form
            document.getElementById('uploadForm').reset();
            
            // Refresh books list
            loadBooks();
            
            // Switch to books tab
            setTimeout(() => {
                switchMainTab('books');
            }, 1500);
        } else {
            showErrorMessage(data.error || '업로드에 실패했습니다.');
        }
    } catch (error) {
        showErrorMessage('업로드 중 오류가 발생했습니다.');
        console.error('Upload error:', error);
    } finally {
        document.getElementById('uploadProgress').style.display = 'none';
    }
}

/**
 * Handle file selection to auto-fill title
 * @param {Event} event - File input change event
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        // Extract title from filename
        const filename = file.name;
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
        
        // Try to parse "Author - Title" format
        const authorTitleMatch = nameWithoutExt.match(/^(.+?)\s*-\s*(.+)$/);
        if (authorTitleMatch) {
            document.getElementById('bookAuthor').value = authorTitleMatch[1].trim();
            document.getElementById('bookTitle').value = authorTitleMatch[2].trim();
        } else {
            // Use filename as title
            document.getElementById('bookTitle').value = nameWithoutExt;
        }
    }
}

/**
 * Load user's books from server
 */
async function loadBooks() {
    const loadingElement = document.getElementById('booksLoading');
    const gridElement = document.getElementById('booksGrid');
    
    loadingElement.style.display = 'block';
    gridElement.innerHTML = '';
    
    try {
        const response = await fetch(`${API_BASE}/books`, {
            headers: {
                'X-Session-Token': sessionToken
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentBooks = data.data;
            displayBooks(currentBooks);
        } else {
            gridElement.innerHTML = '<p>도서를 불러오는데 실패했습니다.</p>';
        }
    } catch (error) {
        gridElement.innerHTML = '<p>서버 연결에 실패했습니다.</p>';
        console.error('Load books error:', error);
    } finally {
        loadingElement.style.display = 'none';
    }
}

/**
 * Display books in the grid
 * @param {Array} books - Array of book objects
 */
function displayBooks(books) {
    const gridElement = document.getElementById('booksGrid');
    
    if (books.length === 0) {
        gridElement.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1 / -1;">아직 업로드된 도서가 없습니다.</p>';
        return;
    }
    
    gridElement.innerHTML = books.map(book => {
        const progress = book.progress || {};
        const progressPercent = progress.progress_percent || 0;
        const lastPage = progress.page || 0;
        const totalPages = progress.total_pages || 'unknown';
        
        return `
            <div class="book-card">
                <div class="book-title">${escapeHtml(book.title)}</div>
                <div class="book-author">${escapeHtml(book.author || '저자 미상')}</div>
                <div class="book-meta">
                    ${book.file_type.toUpperCase()} • ${formatFileSize(book.file_size)}
                    ${book.uploaded_at ? ' • ' + formatDate(book.uploaded_at) : ''}
                </div>
                
                ${book.progress ? `
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div style="font-size: 0.9rem; color: #666;">
                        진행률: ${progressPercent}% ${lastPage > 0 ? `(${lastPage}/${totalPages} 페이지)` : ''}
                    </div>
                ` : '<div style="color: #999; font-style: italic;">아직 읽지 않음</div>'}
                
                <div style="margin-top: 15px;">
                    <button onclick="updateProgress(${book.id})" class="btn" style="width: auto; padding: 8px 15px; margin-right: 10px;">
                        진행상황 업데이트
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Update reading progress for a book
 * @param {number} bookId - Book ID
 */
async function updateProgress(bookId) {
    const book = currentBooks.find(b => b.id === bookId);
    if (!book) return;
    
    const currentProgress = book.progress || {};
    
    // Simple prompt for MVP (can be replaced with modal)
    const page = prompt(`"${book.title}" 현재 페이지:`, currentProgress.page || 0);
    if (page === null) return;
    
    const progressPercent = prompt('진행률 (0-100):', currentProgress.progress_percent || 0);
    if (progressPercent === null) return;
    
    const progressData = {
        page: parseInt(page) || 0,
        progress_percent: parseFloat(progressPercent) || 0,
        updated_at: new Date().toISOString()
    };
    
    try {
        const response = await fetch(`${API_BASE}/books/${bookId}/progress`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken
            },
            body: JSON.stringify(progressData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccessMessage('진행상황이 업데이트되었습니다!');
            loadBooks(); // Refresh books list
        } else {
            showErrorMessage(data.error || '업데이트에 실패했습니다.');
        }
    } catch (error) {
        console.error('Update progress error:', error);
        
        // If offline, save progress update for later sync
        if (!navigator.onLine) {
            savePendingProgressUpdate(bookId, progressData);
            showSuccessMessage('오프라인 상태입니다. 진행률이 임시 저장되었으며 연결 복구 시 동기화됩니다.');
            
            // Update local book data immediately for better UX
            updateLocalBookProgress(bookId, progressData);
        } else {
            showErrorMessage('서버 연결에 실패했습니다.');
        }
    }
}

/**
 * Save progress update for later sync when offline
 * @param {number} bookId - Book ID
 * @param {Object} progressData - Progress data to save
 */
function savePendingProgressUpdate(bookId, progressData) {
    const pendingUpdates = JSON.parse(localStorage.getItem('pendingProgressUpdates') || '[]');
    
    // Remove any existing update for this book
    const filteredUpdates = pendingUpdates.filter(update => update.bookId !== bookId);
    
    // Add new update
    filteredUpdates.push({
        bookId: bookId,
        progressData: progressData,
        timestamp: Date.now()
    });
    
    localStorage.setItem('pendingProgressUpdates', JSON.stringify(filteredUpdates));
    console.log(`Saved pending progress update for book ${bookId}`);
}

/**
 * Update local book progress data immediately for better UX
 * @param {number} bookId - Book ID
 * @param {Object} progressData - Progress data
 */
function updateLocalBookProgress(bookId, progressData) {
    const book = currentBooks.find(b => b.id === bookId);
    if (book) {
        book.progress = progressData;
        displayBooks(currentBooks); // Refresh display
    }
}

/**
 * Show main application interface
 */
function showMainApp() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('mainContainer').style.display = 'block';
    document.getElementById('currentUser').textContent = currentUser;
}

/**
 * Handle user logout
 */
function logout() {
    // Clear session data
    sessionToken = null;
    currentUser = null;
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('currentUser');
    
    // Show auth container
    document.getElementById('authContainer').style.display = 'block';
    document.getElementById('mainContainer').style.display = 'none';
    
    // Clear forms
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
    document.getElementById('uploadForm').reset();
    
    // Clear messages
    hideMessages();
    
    // Reset to login tab
    switchTab('login');
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showErrorMessage(message) {
    const errorElement = document.getElementById('errorMessage');
    const successElement = document.getElementById('successMessage');
    
    successElement.style.display = 'none';
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(hideMessages, 5000);
}

/**
 * Show success message
 * @param {string} message - Success message to display
 */
function showSuccessMessage(message) {
    const errorElement = document.getElementById('errorMessage');
    const successElement = document.getElementById('successMessage');
    
    errorElement.style.display = 'none';
    successElement.textContent = message;
    successElement.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(hideMessages, 3000);
}

/**
 * Hide all messages
 */
function hideMessages() {
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('successMessage').style.display = 'none';
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @return {string} Escaped text
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @return {string} Formatted file size
 */
function formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @return {string} Formatted date
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
