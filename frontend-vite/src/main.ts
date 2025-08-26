import './style.css';
import { thumbnailStorage } from './lib/thumbnail-storage';

console.log('Main.ts loaded - single time');

// 전역 변수로 초기화 상태 추적
(window as any).appInitialized = (window as any).appInitialized || false;

if ((window as any).appInitialized) {
    console.log('App already initialized, exiting');
} else {
    console.log('Initializing app...');
    (window as any).appInitialized = true;

    // 간단한 로그인 폼만 표시
    const appElement = document.querySelector<HTMLDivElement>('#app')!;

    appElement.innerHTML = `
    <div class="auth-container">
      <h1>⚡ MyLibrary</h1>
      <form id="login-form" class="auth-form">
        <input type="text" id="username" placeholder="Username" required>
        <input type="password" id="password" placeholder="Password" required>
        <button type="submit" id="login-btn">Login</button>
        <button type="button" id="register-btn">Register</button>
      </form>
      <div id="status" class="status"></div>
    </div>
  `;

    // 간단한 이벤트 핸들러
    const form = document.querySelector('#login-form') as HTMLFormElement;
    const status = document.querySelector('#status') as HTMLDivElement;

    if (form && status) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Form submitted');

            const username = (document.querySelector('#username') as HTMLInputElement).value;
            const password = (document.querySelector('#password') as HTMLInputElement).value;

            status.textContent = `Attempting to login with: ${username}`;
            status.className = 'status';

            // 실제 API 호출 테스트
            try {
                const response = await fetch('http://localhost:8080/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });

                const result = await response.json();
                console.log('[AUTH] Login response received:', result.success ? 'SUCCESS' : 'FAILED');

                const sessionToken = result.data?.session_token || result.session_token;

                if (response.ok && sessionToken) {
                    localStorage.setItem('sessionToken', sessionToken);
                    status.textContent = 'Login successful!';
                    status.className = 'status success';

                    // 간단한 라이브러리 화면으로 전환
                    showLibrary();
                } else {
                    status.textContent = `Login failed: ${result.error || result.message || 'Unknown error'}`;
                    status.className = 'status error';
                }
            } catch (error) {
                console.error('[AUTH] Login failed:', error);
                status.textContent = `Connection error: ${error}`;
                status.className = 'status error';
            }
        });

        const registerBtn = document.querySelector('#register-btn') as HTMLButtonElement;
        if (registerBtn) {
            registerBtn.addEventListener('click', async () => {
                console.log('Register clicked');

                const username = (document.querySelector('#username') as HTMLInputElement).value;
                const password = (document.querySelector('#password') as HTMLInputElement).value;

                if (!username || !password) {
                    status.textContent = 'Please fill in all fields';
                    status.className = 'status error';
                    return;
                }

                try {
                    const response = await fetch('http://localhost:8080/api/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password }),
                    });

                    const result = await response.json();
                    console.log('Register response:', result);

                    const sessionToken = result.data?.session_token || result.session_token;

                    if (response.ok && sessionToken) {
                        localStorage.setItem('sessionToken', sessionToken);
                        status.textContent = 'Registration successful!';
                        status.className = 'status success';

                        showLibrary();
                    } else {
                        status.textContent = `Registration failed: ${result.error || result.message || 'Unknown error'}`;
                        status.className = 'status error';
                    }
                } catch (error) {
                    console.error('Register error:', error);
                    status.textContent = `Connection error: ${error}`;
                    status.className = 'status error';
                }
            });
        }
    }
}

function showLibrary() {
    const appElement = document.querySelector<HTMLDivElement>('#app')!;

    appElement.innerHTML = `
    <div class="library-container">
      <header class="library-header">
        <h1>📚 My Library</h1>
        <div class="header-actions">
          <button id="upload-btn">Upload Book</button>
          <button id="admin-btn" title="Server Administration">⚙️ Admin</button>
          <button id="logout-btn">Logout</button>
        </div>
      </header>
      <div id="books-grid" class="books-grid">
        <div class="no-books">
          <h3>Loading books...</h3>
        </div>
      </div>
      <div id="status" class="status"></div>
    </div>
  `;

    // 로그아웃 버튼
    const logoutBtn = document.querySelector('#logout-btn') as HTMLButtonElement;
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('sessionToken');
            location.reload();
        });
    }

    // 업로드 버튼
    const uploadBtn = document.querySelector('#upload-btn') as HTMLButtonElement;
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            showUploadModal();
        });
    }

    // Admin 버튼
    const adminBtn = document.querySelector('#admin-btn') as HTMLButtonElement;
    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            showAdminPage();
        });
    }


    // 썸네일 캐시 초기화 (백그라운드)
    initThumbnailCache();
    
    // 책 목록 로드
    loadBooks();
}

async function loadBooks() {
    const grid = document.querySelector('#books-grid') as HTMLDivElement;
    const token = localStorage.getItem('sessionToken');

    if (!grid || !token) return;

    try {
        const response = await fetch('http://localhost:8080/api/books', {
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': token,
            },
        });

        const result = await response.json();
        console.log(`[API] Books loaded: ${result.data?.length || 0} items`);

        if (response.ok && result.data) {
            const books = result.data;

            if (books.length === 0) {
                grid.innerHTML = `
          <div class="no-books">
            <h3>No books found</h3>
            <p>Upload your first book to get started!</p>
          </div>
        `;
            } else {
                grid.innerHTML = books.map((book: any, index: number) => `
          <div class="book-card" data-book-id="${book.id}">
            <div class="book-cover" id="cover-${book.id}">
              <div class="thumbnail-loading">⠋</div>
              <img class="thumbnail-image" style="display:none;" 
                   alt="${getDisplayTitle(book.title, book.file_path, index)}" 
                   onerror="this.style.display='none'; this.parentElement.querySelector('.cover-placeholder').style.display='flex'">
              <div class="cover-placeholder" style="display:none">📖</div>
            </div>
            <div class="book-info">
              <div class="book-title">${getDisplayTitle(book.title, book.file_path, index)}</div>
              <div class="book-author">${book.author || ''}</div>
              <div class="book-meta">
                <span>${book.file_type?.toUpperCase() || 'UNKNOWN'}</span>
                <span>${(book.file_size / 1024 / 1024).toFixed(1)}MB</span>
              </div>
            </div>
            <div class="book-actions">
              <button class="read-btn" data-book-id="${book.id}">Read</button>
              <button class="download-btn" data-book-id="${book.id}">📥 Offline</button>
            </div>
          </div>
        `).join('');

        // 이벤트 핸들러 설정
        setupBookEventHandlers();
        
        // 썸네일 로딩 시작
        loadThumbnailsForBooks(books);
      }
        } else {
            grid.innerHTML = `
        <div class="error-message">
          <h3>Failed to load books</h3>
          <p>${result.message || 'Unknown error'}</p>
        </div>
      `;
        }
    } catch (error) {
        console.error('[API] Failed to load books:', error);
        grid.innerHTML = `
      <div class="error-message">
        <h3>Connection error</h3>
        <p>${error}</p>
      </div>
    `;
    }
}

function setupBookEventHandlers() {
    const grid = document.querySelector('#books-grid') as HTMLDivElement;
    if (!grid) return;

    grid.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const bookId = target.dataset.bookId;

        if (!bookId) return;

        if (target.classList.contains('read-btn')) {
            console.log(`[READER] Opening reader for book ID: ${bookId}`);
            await openBookReader(parseInt(bookId));
        } else if (target.classList.contains('download-btn')) {
            console.log(`[DOWNLOAD] Starting offline download for book ID: ${bookId}`);
            await downloadBookForOffline(parseInt(bookId), target as HTMLButtonElement);
        }
    });
}

async function openBookReader(bookId: number) {
    const token = localStorage.getItem('sessionToken');
    if (!token) return;

    try {
        // 책 파일 다운로드
        console.log(`[READER] Fetching book file for ID: ${bookId}...`);
        const response = await fetch(`http://localhost:8080/api/books/${bookId}/file`, {
            headers: {
                'X-Session-Token': token,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to download book: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log(`[READER] Book file downloaded, size: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

        // 간단한 리더 모달 표시
        showSimpleReader(bookId, arrayBuffer);

    } catch (error) {
        console.error('[READER] Failed to open reader:', error);
        const status = document.querySelector('#status') as HTMLDivElement;
        if (status) {
            status.textContent = `Failed to open book: ${error}`;
            status.className = 'status error';
        }
    }
}

function showSimpleReader(_bookId: number, data: ArrayBuffer) {
    // 간단한 리더 모달 생성
    const modal = document.createElement('div');
    modal.className = 'reader-modal';
    modal.innerHTML = `
    <div class="reader-content">
      <div class="reader-header">
        <h3>Book Reader</h3>
        <button class="close-reader">✕</button>
      </div>
      <div class="reader-body">
        <p>Book loaded successfully!</p>
        <p>File size: ${(data.byteLength / 1024 / 1024).toFixed(2)} MB</p>
        <p>Reader implementation coming soon...</p>
      </div>
    </div>
  `;

    document.body.appendChild(modal);

    // 닫기 버튼 이벤트
    const closeBtn = modal.querySelector('.close-reader') as HTMLButtonElement;
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }

    // 모달 배경 클릭으로 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

async function downloadBookForOffline(bookId: number, button: HTMLButtonElement) {
    const token = localStorage.getItem('sessionToken');
    if (!token) return;

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '⏳ Downloading...';

    try {
        const response = await fetch(`http://localhost:8080/api/books/${bookId}/file`, {
            headers: {
                'X-Session-Token': token,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to download: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        // IndexedDB에 저장 (간단한 구현)
        const db = await openOfflineDB();
        const tx = db.transaction(['books'], 'readwrite');
        const store = tx.objectStore('books');

        await store.put({
            id: bookId,
            data: arrayBuffer,
            downloadedAt: new Date().toISOString()
        });

        button.textContent = '✓ Downloaded';
        button.classList.add('downloaded');

        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
            button.classList.remove('downloaded');
        }, 2000);

    } catch (error) {
        console.error('Download failed:', error);
        button.textContent = '❌ Failed';

        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 2000);
    }
}

function openOfflineDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('MyLibraryOffline', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('books')) {
                db.createObjectStore('books', { keyPath: 'id' });
            }
        };
    });
}

function getDisplayTitle(title: string, filePath: string, index: number): string {
    // 의미있는 제목인지 확인 (숫자만 있거나 너무 짧으면 파일명 사용)
    if (!title || title.trim().length === 0 || /^\d+$/.test(title.trim()) || title.trim().length < 2) {
        // 파일 경로에서 파일명 추출하고 확장자 제거
        if (filePath) {
            const fileName = filePath.split('/').pop() || filePath;
            const nameWithoutExt = fileName.replace(/\.(epub|pdf|zip|cbz|cbr)$/i, '');
            if (nameWithoutExt.length > 2) {
                return nameWithoutExt;
            }
        }
        return `Book ${index + 1}`;
    }

    return title.trim();
}

/**
 * @brief 스피너 애니메이션을 시작합니다
 * @param element 스피너를 표시할 엘리먼트
 */
function startSpinner(element: HTMLElement): number {
  const spinnerChars = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
  let index = 0;
  
  return setInterval(() => {
    element.textContent = spinnerChars[index];
    index = (index + 1) % spinnerChars.length;
  }, 150) as unknown as number;
}

/**
 * @brief 스피너 애니메이션을 중지합니다
 * @param intervalId setInterval에서 반환된 ID
 */
function stopSpinner(intervalId: number): void {
  clearInterval(intervalId);
}

/**
 * @brief 도서 목록의 모든 썸네일을 로드합니다
 * @param books 도서 목록 데이터
 */
async function loadThumbnailsForBooks(books: any[]): Promise<void> {
  books.forEach(book => {
    loadThumbnailForBook(book.id.toString(), book.thumbnail_path);
  });
}

/**
 * @brief 개별 도서의 썸네일을 로드합니다
 * @param bookId 도서 ID
 * @param thumbnailPath 썸네일 경로 (있는 경우)
 */
async function loadThumbnailForBook(bookId: string, thumbnailPath?: string): Promise<void> {
  const coverElement = document.getElementById(`cover-${bookId}`);
  if (!coverElement) return;
  
  const loadingEl = coverElement.querySelector('.thumbnail-loading') as HTMLElement;
  const imgEl = coverElement.querySelector('.thumbnail-image') as HTMLImageElement;
  const placeholderEl = coverElement.querySelector('.cover-placeholder') as HTMLElement;
  
  if (!loadingEl || !imgEl || !placeholderEl) return;
  
  // 스피너 시작
  const spinnerId = startSpinner(loadingEl);
  
  try {
    const token = localStorage.getItem('sessionToken');
    if (!token) {
      showPlaceholder(loadingEl, placeholderEl, spinnerId);
      return;
    }
    
    // 썸네일이 데이터베이스에 등록되어 있지 않으면 플레이스홀더 표시
    if (!thumbnailPath) {
      showPlaceholder(loadingEl, placeholderEl, spinnerId);
      return;
    }
    
    // 1. 먼저 로컬 캐시에서 확인
    try {
      const cachedBlob = await thumbnailStorage.getThumbnail(bookId);
      if (cachedBlob) {
        const objectURL = URL.createObjectURL(cachedBlob);
        showThumbnail(imgEl, loadingEl, placeholderEl, objectURL, spinnerId);
        console.log(`[CACHE] Using cached thumbnail for book ${bookId}`);
        return;
      }
    } catch (cacheError) {
      console.warn(`[CACHE] Cache lookup failed for book ${bookId}:`, cacheError);
    }
    
    // 2. 캐시에 없으면 서버에서 가져오기
    const response = await fetch(`http://localhost:8080/api/books/${bookId}/thumbnail`, {
      headers: { 'X-Session-Token': token }
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const objectURL = URL.createObjectURL(blob);
      showThumbnail(imgEl, loadingEl, placeholderEl, objectURL, spinnerId);
      
      // 3. 서버에서 가져온 썸네일을 캐시에 저장 (백그라운드)
      try {
        await thumbnailStorage.storeThumbnail(bookId, blob);
      } catch (storeError) {
        console.warn(`[CACHE] Cache storage failed for book ${bookId}:`, storeError);
      }
      
      console.log(`[THUMBNAIL] Loaded from server and cached for book ${bookId}`);
    } else {
      showPlaceholder(loadingEl, placeholderEl, spinnerId);
    }
  } catch (error) {
    console.warn(`[THUMBNAIL] Failed to load thumbnail for book ${bookId}:`, error);
    showPlaceholder(loadingEl, placeholderEl, spinnerId);
  }
}

/**
 * @brief 썸네일 이미지를 표시합니다
 * @param imgEl 이미지 엘리먼트
 * @param loadingEl 로딩 엘리먼트
 * @param placeholderEl 플레이스홀더 엘리먼트
 * @param imageUrl 이미지 URL
 * @param spinnerId 스피너 ID
 */
function showThumbnail(imgEl: HTMLImageElement, loadingEl: HTMLElement, placeholderEl: HTMLElement, imageUrl: string, spinnerId: number): void {
  stopSpinner(spinnerId);
  loadingEl.style.display = 'none';
  imgEl.src = imageUrl;
  imgEl.style.display = 'block';
  placeholderEl.style.display = 'none';
}

/**
 * @brief 플레이스홀더를 표시합니다
 * @param loadingEl 로딩 엘리먼트
 * @param placeholderEl 플레이스홀더 엘리먼트
 * @param spinnerId 스피너 ID
 */
function showPlaceholder(loadingEl: HTMLElement, placeholderEl: HTMLElement, spinnerId: number): void {
  stopSpinner(spinnerId);
  loadingEl.style.display = 'none';
  placeholderEl.style.display = 'flex';
}

/**
 * @brief 업로드 모달을 표시합니다
 */
function showUploadModal(): void {
  // 기존 모달이 있으면 제거
  const existingModal = document.querySelector('.upload-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // 모달 HTML 생성
  const modalHTML = `
    <div class="upload-modal modal">
      <div class="modal-content">
        <h2>📚 Upload Book</h2>
        <form id="upload-form" enctype="multipart/form-data">
          <div class="upload-field">
            <label for="book-file">Select Book File (EPUB, PDF, CBZ, CBR):</label>
            <input type="file" id="book-file" name="file" accept=".epub,.pdf,.cbz,.cbr" required>
          </div>
          <div class="upload-field">
            <label for="book-title">Title (optional):</label>
            <input type="text" id="book-title" name="title" placeholder="Will be extracted from file if left empty">
          </div>
          <div class="upload-field">
            <label for="book-author">Author (optional):</label>
            <input type="text" id="book-author" name="author" placeholder="Will be extracted from file if left empty">
          </div>
          <div class="upload-actions">
            <button type="button" id="cancel-upload">Cancel</button>
            <button type="submit" id="submit-upload">Upload</button>
          </div>
        </form>
        <div id="upload-status" class="upload-status"></div>
      </div>
    </div>
  `;

  // 모달을 DOM에 추가
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const modal = document.querySelector('.upload-modal') as HTMLElement;
  const form = document.querySelector('#upload-form') as HTMLFormElement;
  const cancelBtn = document.querySelector('#cancel-upload') as HTMLButtonElement;
  const statusDiv = document.querySelector('#upload-status') as HTMLElement;

  // 취소 버튼 이벤트
  cancelBtn.addEventListener('click', () => {
    modal.remove();
  });

  // 모달 배경 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // 폼 제출 이벤트
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleFileUpload(form, statusDiv, modal);
  });
}

/**
 * @brief 파일 업로드를 처리합니다
 * @param form 업로드 폼 엘리먼트
 * @param statusDiv 상태 표시 엘리먼트
 * @param modal 모달 엘리먼트
 */
async function handleFileUpload(form: HTMLFormElement, statusDiv: HTMLElement, modal: HTMLElement): Promise<void> {
  const token = localStorage.getItem('sessionToken');
  if (!token) {
    statusDiv.innerHTML = '<div class="status error">Authentication required. Please login again.</div>';
    return;
  }

  const formData = new FormData(form);
  const fileInput = form.querySelector('#book-file') as HTMLInputElement;
  
  if (!fileInput.files || fileInput.files.length === 0) {
    statusDiv.innerHTML = '<div class="status error">Please select a file to upload.</div>';
    return;
  }

  const file = fileInput.files[0];
  const maxSize = 100 * 1024 * 1024; // 100MB
  
  if (file.size > maxSize) {
    statusDiv.innerHTML = '<div class="status error">File too large. Maximum size is 100MB.</div>';
    return;
  }

  // 업로드 중 상태 표시
  statusDiv.innerHTML = '<div class="status">Uploading... <span class="spinner">⠋</span></div>';
  
  const submitBtn = form.querySelector('#submit-upload') as HTMLButtonElement;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading...';

  try {
    const response = await fetch('http://localhost:8080/api/books/upload', {
      method: 'POST',
      headers: {
        'X-Session-Token': token
      },
      body: formData
    });

    const result = await response.json();

    if (response.ok && result.success) {
      statusDiv.innerHTML = '<div class="status success">Book uploaded successfully!</div>';
      
      // 2초 후 모달 닫고 도서 목록 새로고침
      setTimeout(() => {
        modal.remove();
        loadBooks(); // 도서 목록 새로고침
      }, 2000);
    } else {
      statusDiv.innerHTML = `<div class="status error">Upload failed: ${result.error || 'Unknown error'}</div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Upload';
    }
  } catch (error) {
    console.error('Upload error:', error);
    statusDiv.innerHTML = '<div class="status error">Network error. Please try again.</div>';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Upload';
  }
}

/**
 * @brief 고아 레코드(삭제된 파일의 DB 레코드) 정리
 */
async function cleanupOrphanedBooks(): Promise<void> {
    const token = localStorage.getItem('sessionToken');
    if (!token) {
        alert('Authentication required');
        return;
    }

    // 확인 대화상자
    if (!confirm('파일이 삭제된 도서를 목록에서 제거하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
        return;
    }

    const cleanupBtn = document.querySelector('#cleanup-btn') as HTMLButtonElement;
    const originalText = cleanupBtn.textContent;
    
    try {
        // 버튼 상태 변경
        cleanupBtn.disabled = true;
        cleanupBtn.textContent = '🔄 정리 중...';

        const response = await fetch('http://localhost:8080/api/library/cleanup-orphaned', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': token,
            },
        });

        const result = await response.json();
        console.log('Cleanup response:', result);

        if (response.ok && result.success) {
            const count = result.cleaned_count || 0;
            
            // 성공 메시지 표시
            showStatusMessage(`✅ Successfully cleaned up ${count} orphaned records`, 'success');
            
            // 도서 목록 새로고침
            if (count > 0) {
                await loadBooks();
            }
        } else {
            showStatusMessage(`❌ Cleanup failed: ${result.message || 'Unknown error'}`, 'error');
        }
        
    } catch (error) {
        console.error('[API] Cleanup operation error:', error);
        showStatusMessage('❌ Network error occurred', 'error');
    } finally {
        // 버튼 상태 복원
        cleanupBtn.disabled = false;
        cleanupBtn.textContent = originalText;
    }
}

/**
 * @brief 모니터링 페이지 표시
 * @param operationType 작업 유형 ('cleanup' 또는 'sync-scan')
 */
async function showMonitoringPage(operationType: 'cleanup' | 'sync-scan' | 'library-scan'): Promise<void> {
    const appElement = document.querySelector<HTMLDivElement>('#app')!;
    
    const operationTitles = {
        'cleanup': '🧹 Orphaned Records Cleanup',
        'sync-scan': '🔄 Library Sync Scan', 
        'library-scan': '🔍 Library Scan'
    };
    const operationTitle = operationTitles[operationType];
    
    appElement.innerHTML = `
    <div class="monitoring-container">
      <header class="monitoring-header">
        <div class="monitoring-title">
          <h1>${operationTitle}</h1>
          <div class="monitoring-status" id="monitoring-status">준비 중...</div>
        </div>
        <div class="monitoring-actions">
          <button id="stop-operation-btn" style="display:none;" class="danger">중지</button>
          <button id="back-to-library-btn" style="display:none;">📚 라이브러리로 돌아가기</button>
        </div>
      </header>
      
      <div class="terminal-container">
        <div class="terminal-header">
          <div class="terminal-controls">
            <div class="terminal-control red"></div>
            <div class="terminal-control yellow"></div>
            <div class="terminal-control green"></div>
          </div>
          <div class="terminal-title">MyLibrary ${operationType} Console</div>
        </div>
        
        <div class="terminal-body" id="terminal-log">
          <div class="log-line startup">
            <span class="timestamp">[${new Date().toLocaleTimeString()}]</span>
            <span class="level info">INFO</span>
            <span class="message">${operationTitle} 준비 중...</span>
          </div>
        </div>
      </div>
      
      <div class="monitoring-stats" id="monitoring-stats" style="display:none;">
        <div class="stat-item">
          <span class="stat-label">진행률</span>
          <div class="progress-bar">
            <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
          </div>
          <span class="stat-value" id="progress-text">0%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">처리된 도서</span>
          <span class="stat-value" id="processed-count">0</span>
        </div>
        <div class="stat-item" id="orphaned-stat" style="display:none;">
          <span class="stat-label">정리된 고아 레코드</span>
          <span class="stat-value" id="orphaned-count">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">소요 시간</span>
          <span class="stat-value" id="elapsed-time">00:00</span>
        </div>
      </div>
    </div>
  `;
  
    // 스타일 추가
    addMonitoringStyles();
    
    // 이벤트 핸들러 설정
    setupMonitoringEventHandlers(operationType);
    
    // DOM이 완전히 렌더링된 후 작업 시작
    requestAnimationFrame(() => {
        setTimeout(async () => {
            await startMonitoringOperation(operationType);
        }, 50);
    });
}

/**
 * @brief 모니터링 페이지 스타일 추가
 */
function addMonitoringStyles(): void {
    if (document.getElementById('monitoring-styles')) return; // 이미 추가됨
    
    const style = document.createElement('style');
    style.id = 'monitoring-styles';
    style.textContent = `
    .monitoring-container {
      min-height: 100vh;
      background: #1a1a1a;
      color: #e0e0e0;
      padding: 20px;
      font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
    }
    
    .monitoring-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid #333;
    }
    
    .monitoring-title h1 {
      margin: 0 0 10px 0;
      color: #4CAF50;
      font-size: 1.8rem;
    }
    
    .monitoring-status {
      color: #FFC107;
      font-size: 1rem;
      font-weight: 500;
    }
    
    .monitoring-actions {
      display: flex;
      gap: 10px;
    }
    
    .monitoring-actions button {
      padding: 10px 20px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-family: inherit;
      font-size: 0.9rem;
      transition: all 0.3s ease;
    }
    
    .monitoring-actions button:not(.danger) {
      background: #4CAF50;
      color: white;
    }
    
    .monitoring-actions button.danger {
      background: #f44336;
      color: white;
    }
    
    .monitoring-actions button:hover {
      opacity: 0.8;
      transform: translateY(-2px);
    }
    
    .terminal-container {
      background: #000;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    
    .terminal-header {
      background: #2d2d2d;
      padding: 10px 15px;
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .terminal-controls {
      display: flex;
      gap: 8px;
    }
    
    .terminal-control {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    
    .terminal-control.red { background: #ff5f56; }
    .terminal-control.yellow { background: #ffbd2e; }
    .terminal-control.green { background: #27ca3f; }
    
    .terminal-title {
      color: #c0c0c0;
      font-size: 0.9rem;
      font-weight: 500;
    }
    
    .terminal-body {
      padding: 20px;
      min-height: 400px;
      max-height: 60vh;
      overflow-y: auto;
      font-size: 0.9rem;
      line-height: 1.6;
    }
    
    .log-line {
      margin-bottom: 8px;
      display: flex;
      gap: 10px;
      word-wrap: break-word;
    }
    
    .log-line.startup { color: #4CAF50; }
    .log-line.info { color: #2196F3; }
    .log-line.success { color: #4CAF50; }
    .log-line.warning { color: #FFC107; }
    .log-line.error { color: #f44336; }
    
    .timestamp {
      color: #666;
      min-width: 90px;
      font-size: 0.8rem;
    }
    
    .level {
      min-width: 50px;
      font-weight: bold;
      text-transform: uppercase;
    }
    
    .level.info { color: #2196F3; }
    .level.success { color: #4CAF50; }
    .level.warning { color: #FFC107; }
    .level.error { color: #f44336; }
    
    .message {
      flex: 1;
    }
    
    .monitoring-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      background: #2d2d2d;
      padding: 20px;
      border-radius: 8px;
    }
    
    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .stat-label {
      color: #888;
      font-size: 0.9rem;
      text-transform: uppercase;
    }
    
    .stat-value {
      color: #4CAF50;
      font-size: 1.4rem;
      font-weight: bold;
    }
    
    .progress-bar {
      width: 100%;
      height: 8px;
      background: #333;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4CAF50, #8BC34A);
      transition: width 0.3s ease;
      border-radius: 4px;
    }
    
    /* 스크롤바 스타일 */
    .terminal-body::-webkit-scrollbar {
      width: 8px;
    }
    
    .terminal-body::-webkit-scrollbar-track {
      background: #1a1a1a;
    }
    
    .terminal-body::-webkit-scrollbar-thumb {
      background: #555;
      border-radius: 4px;
    }
    
    .terminal-body::-webkit-scrollbar-thumb:hover {
      background: #777;
    }
  `;
    
    document.head.appendChild(style);
}

/**
 * @brief 썸네일 캐시 초기화
 */
async function initThumbnailCache(): Promise<void> {
    try {
        await thumbnailStorage.init();
        
        // 만료된 캐시 정리 (백그라운드)
        setTimeout(async () => {
            try {
                await thumbnailStorage.clearExpired();
                const stats = await thumbnailStorage.getCacheStats();
                console.log(`[CACHE] Thumbnail cache statistics: ${stats.count} items, ${(stats.totalSize / 1024 / 1024).toFixed(1)}MB`);
            } catch (error) {
                console.warn('[CACHE] Thumbnail cache cleanup failed:', error);
            }
        }, 1000);
    } catch (error) {
        console.warn('[CACHE] Thumbnail cache initialization failed:', error);
    }
}

/**
 * @brief 상태 메시지 표시 유틸리티 함수
 */
function showStatusMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const statusDiv = document.querySelector('#status') as HTMLDivElement;
    if (statusDiv) {
        statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
        
        // 3초 후 메시지 자동 제거
        setTimeout(() => {
            statusDiv.innerHTML = '';
        }, 3000);
    }
}

/**
 * @brief 동기화 스캔 시작 (파일 검색 + 고아 정리)
 */
async function startSyncScan(): Promise<void> {
    const token = localStorage.getItem('sessionToken');
    if (!token) {
        alert('Authentication required');
        return;
    }

    // 확인 대화상자
    if (!confirm('라이브러리 동기화 스캔을 시작하시겠습니까?\n\n새로운 도서 검색과 고아 레코드 정리를 수행합니다.')) {
        return;
    }

    const syncScanBtn = document.querySelector('#sync-scan-btn') as HTMLButtonElement;
    const originalText = syncScanBtn.textContent;
    
    try {
        // 버튼 상태 변경
        syncScanBtn.disabled = true;
        syncScanBtn.textContent = '🔄 스캔 시작...';

        const response = await fetch('http://localhost:8080/api/library/sync-scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': token,
            },
        });

        const result = await response.json();
        console.log('[API] Synchronization scan response:', result.success ? 'SUCCESS' : 'FAILED');

        if (response.ok && result.success) {
            showStatusMessage('✅ Library synchronization scan started', 'success');
            // 스캔 모니터링 시작
            startScanMonitoring();
        } else {
            showStatusMessage(`❌ Scan start failed: ${result.message || 'Unknown error'}`, 'error');
            syncScanBtn.disabled = false;
            syncScanBtn.textContent = originalText;
        }
        
    } catch (error) {
        console.error('[API] Synchronization scan error:', error);
        showStatusMessage('❌ Network error occurred', 'error');
        syncScanBtn.disabled = false;
        syncScanBtn.textContent = originalText;
    }
}

/**
 * @brief 스캔 상태 모니터링 시작
 */
let scanMonitoringInterval: number | null = null;

function startScanMonitoring(): void {
    if (scanMonitoringInterval) {
        clearInterval(scanMonitoringInterval);
    }
    
    // 2초마다 상태 확인
    scanMonitoringInterval = setInterval(async () => {
        await checkScanStatus();
    }, 2000);
    
    // 즉시 한 번 확인
    checkScanStatus();
}

/**
 * @brief 스캔 상태 확인 및 UI 업데이트
 */
async function checkScanStatus(): Promise<void> {
    const token = localStorage.getItem('sessionToken');
    if (!token) return;

    try {
        const response = await fetch('http://localhost:8080/api/library/scan-status', {
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': token,
            },
        });

        if (response.ok) {
            const status = await response.json();
            updateScanUI(status);
            
            // 스캔 완료시 모니터링 중지
            if (!status.is_scanning) {
                stopScanMonitoring();
                onScanCompleted(status);
            }
        }
        
    } catch (error) {
        console.error('[API] Scan status check error:', error);
    }
}

/**
 * @brief 스캔 모니터링 중지
 */
function stopScanMonitoring(): void {
    if (scanMonitoringInterval) {
        clearInterval(scanMonitoringInterval);
        scanMonitoringInterval = null;
    }
}

/**
 * @brief 스캔 상태에 따른 UI 업데이트
 */
function updateScanUI(status: any): void {
    const syncScanBtn = document.querySelector('#sync-scan-btn') as HTMLButtonElement;
    
    if (status.is_scanning) {
        syncScanBtn.disabled = true;
        
        const progress = status.progress_percentage || 0;
        const current = status.processed_books || 0;
        const total = status.total_books || 0;
        const orphaned = status.orphaned_cleaned || 0;
        
        if (orphaned > 0) {
            syncScanBtn.textContent = `🔄 스캔 중... (${progress}%) [${orphaned} 정리됨]`;
        } else {
            syncScanBtn.textContent = `🔄 스캔 중... (${progress}%)`;
        }
        
        // 현재 처리 중인 도서 표시
        if (status.current_book) {
            showStatusMessage(`📖 Processing: ${status.current_book} (${current}/${total})`, 'info');
        }
    }
}

/**
 * @brief 스캔 완료 처리
 */
async function onScanCompleted(status: any): Promise<void> {
    const syncScanBtn = document.querySelector('#sync-scan-btn') as HTMLButtonElement;
    
    // 버튼 상태 복원
    syncScanBtn.disabled = false;
    syncScanBtn.textContent = '🔄 Sync Scan';
    
    // 완료 메시지 표시
    const processed = status.processed_books || 0;
    const orphaned = status.orphaned_cleaned || 0;
    
    let message = `✅ Scan completed: ${processed} books processed`;
    if (orphaned > 0) {
        message += `, ${orphaned} orphaned records cleaned`;
    }
    
    showStatusMessage(message, 'success');
    
    // 도서 목록 새로고침
    await loadBooks();
}

// ============================================================================
// Admin 페이지
// ============================================================================

/**
 * @brief 관리자 페이지 표시
 */
function showAdminPage(): void {
    const appElement = document.querySelector<HTMLDivElement>('#app')!;
    
    appElement.innerHTML = `
    <div class="admin-container">
      <header class="admin-header">
        <h1>⚙️ Server Administration</h1>
        <button id="back-to-library" class="back-btn">← Back to Library</button>
      </header>
      
      <div class="admin-content">
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

        <div class="admin-section">
          <h2>💾 Cache Management</h2>
          <div class="admin-actions">
            <button id="clear-thumbnails-btn" class="admin-action-btn secondary">
              <span class="btn-icon">🖼️</span>
              <span class="btn-text">
                <strong>Clear Thumbnail Cache</strong>
                <small>Remove all cached thumbnails</small>
              </span>
            </button>
            
            <button id="cache-stats-btn" class="admin-action-btn info">
              <span class="btn-icon">📊</span>
              <span class="btn-text">
                <strong>Cache Statistics</strong>
                <small>View cache usage information</small>
              </span>
            </button>
          </div>
        </div>

        <div class="admin-section">
          <h2>📊 Server Status</h2>
          <div class="status-grid">
            <div class="status-card" id="scan-status-card">
              <div class="status-title">Scanner Status</div>
              <div class="status-value" id="scanner-status">Idle</div>
            </div>
            <div class="status-card" id="library-stats-card">
              <div class="status-title">Library Stats</div>
              <div class="status-value" id="library-stats">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
    
    addAdminStyles();
    setupAdminEventHandlers();
    updateAdminStatus();
}

/**
 * @brief Admin 페이지 스타일 추가
 */
function addAdminStyles(): void {
    if (document.getElementById('admin-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'admin-styles';
    style.textContent = `
        .admin-container {
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
        }

        .admin-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 20px 30px;
            border-radius: 15px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .admin-header h1 {
            color: white;
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }

        .back-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
        }

        .back-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-1px);
        }

        .admin-content {
            display: grid;
            gap: 25px;
        }

        .admin-section {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 25px;
        }

        .admin-section h2 {
            color: white;
            margin: 0 0 20px 0;
            font-size: 20px;
            font-weight: 600;
        }

        .admin-actions {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 15px;
        }

        .admin-action-btn {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 20px;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            text-align: left;
            transition: all 0.3s ease;
            font-family: inherit;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .admin-action-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }

        .admin-action-btn.primary {
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
        }

        .admin-action-btn.secondary {
            background: linear-gradient(135deg, #2196F3, #1976D2);
            color: white;
        }

        .admin-action-btn.warning {
            background: linear-gradient(135deg, #FF9800, #F57C00);
            color: white;
        }

        .admin-action-btn.info {
            background: linear-gradient(135deg, #17a2b8, #138496);
            color: white;
        }

        .btn-icon {
            font-size: 24px;
            flex-shrink: 0;
        }

        .btn-text {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .btn-text strong {
            font-size: 16px;
            font-weight: 600;
        }

        .btn-text small {
            font-size: 13px;
            opacity: 0.9;
            line-height: 1.3;
        }

        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }

        .status-card {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .status-title {
            color: rgba(255, 255, 255, 0.8);
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 8px;
        }

        .status-value {
            color: white;
            font-size: 18px;
            font-weight: 600;
        }

        .admin-action-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none !important;
        }

        @media (max-width: 768px) {
            .admin-container {
                padding: 10px;
            }
            
            .admin-header {
                flex-direction: column;
                gap: 15px;
                text-align: center;
            }
            
            .admin-actions {
                grid-template-columns: 1fr;
            }
        }
    `;
    
    document.head.appendChild(style);
}

/**
 * @brief Admin 페이지 이벤트 핸들러 설정
 */
function setupAdminEventHandlers(): void {
    // Back to Library 버튼
    const backBtn = document.querySelector('#back-to-library') as HTMLButtonElement;
    backBtn?.addEventListener('click', async () => {
        await showLibrary();
    });

    // Library Scan 버튼
    const libraryScanBtn = document.querySelector('#library-scan-btn') as HTMLButtonElement;
    libraryScanBtn?.addEventListener('click', async () => {
        await startLibraryScan();
    });

    // Sync Scan 버튼 - 모니터링 페이지로 이동
    const syncScanBtn = document.querySelector('#sync-scan-btn') as HTMLButtonElement;
    syncScanBtn?.addEventListener('click', async () => {
        await showMonitoringPage('sync-scan');
    });

    // Cleanup 버튼 - 모니터링 페이지로 이동
    const cleanupBtn = document.querySelector('#cleanup-btn') as HTMLButtonElement;
    cleanupBtn?.addEventListener('click', async () => {
        await showMonitoringPage('cleanup');
    });

    // Clear Thumbnails 버튼
    const clearThumbnailsBtn = document.querySelector('#clear-thumbnails-btn') as HTMLButtonElement;
    clearThumbnailsBtn?.addEventListener('click', async () => {
        await clearThumbnailCache();
    });

    // Cache Stats 버튼
    const cacheStatsBtn = document.querySelector('#cache-stats-btn') as HTMLButtonElement;
    cacheStatsBtn?.addEventListener('click', async () => {
        await showCacheStats();
    });
}

/**
 * @brief 라이브러리 스캔 시작
 */
async function startLibraryScan(): Promise<void> {
    const scanBtn = document.querySelector('#library-scan-btn') as HTMLButtonElement;
    if (!scanBtn) return;

    const originalText = scanBtn.innerHTML;
    scanBtn.disabled = true;
    scanBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text"><strong>Scanning...</strong><small>Please wait</small></span>';

    try {
        const response = await fetch('http://localhost:8080/api/library/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
            }
        });

        const result = await response.json();
        console.log('[API] Library scan response:', result.success ? 'SUCCESS' : 'FAILED');

        if (response.ok && result.success) {
            // 스캔 시작됨 - 모니터링 페이지로 이동
            await showMonitoringPage('library-scan');
        } else {
            alert(`Scan failed: ${result.message || 'Unknown error'}`);
        }

    } catch (error) {
        console.error('[API] Library scan error:', error);
        alert('Network error occurred');
    } finally {
        scanBtn.disabled = false;
        scanBtn.innerHTML = originalText;
    }
}

/**
 * @brief 썸네일 캐시 정리
 */
async function clearThumbnailCache(): Promise<void> {
    if (!confirm('Are you sure you want to clear all thumbnail cache?')) {
        return;
    }

    try {
        await thumbnailStorage.clearAll();
        alert('Thumbnail cache cleared successfully');
        updateAdminStatus();
    } catch (error) {
        console.error('[CACHE] Failed to clear thumbnail cache:', error);
        alert('Failed to clear cache');
    }
}

/**
 * @brief 캐시 통계 표시
 */
async function showCacheStats(): Promise<void> {
    try {
        const stats = await thumbnailStorage.getCacheStats();
        const sizeInMB = (stats.totalSize / 1024 / 1024).toFixed(2);
        
        alert(`Thumbnail Cache Statistics:
        
Items: ${stats.count}
Total Size: ${sizeInMB} MB
        
Click OK to continue.`);
        
    } catch (error) {
        console.error('[CACHE] Failed to get cache stats:', error);
        alert('Failed to retrieve cache statistics');
    }
}

/**
 * @brief Admin 상태 정보 업데이트
 */
async function updateAdminStatus(): Promise<void> {
    try {
        // Scanner status 확인
        const scannerStatus = document.querySelector('#scanner-status');
        if (scannerStatus) {
            const response = await fetch('http://localhost:8080/api/library/scan-status', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                const isScanning = result.data?.is_scanning || false;
                scannerStatus.textContent = isScanning ? 'Running' : 'Idle';
                scannerStatus.style.color = isScanning ? '#4CAF50' : '#fff';
            }
        }

        // Library stats 확인
        const libraryStats = document.querySelector('#library-stats');
        if (libraryStats) {
            const stats = await thumbnailStorage.getCacheStats();
            const sizeInMB = (stats.totalSize / 1024 / 1024).toFixed(1);
            libraryStats.textContent = `Cache: ${stats.count} items, ${sizeInMB}MB`;
        }

    } catch (error) {
        console.error('[ADMIN] Failed to update status:', error);
    }
}

// ============================================================================
// 모니터링 페이지 로직
// ============================================================================

interface MonitoringOperation {
    type: 'cleanup' | 'sync-scan' | 'library-scan';
    isRunning: boolean;
    pollInterval?: number;
}

let currentMonitoringOperation: MonitoringOperation | null = null;

/**
 * @brief 모니터링 페이지 이벤트 핸들러 설정
 */
function setupMonitoringEventHandlers(operationType: 'cleanup' | 'sync-scan'): void {
    // 뒤로 가기 버튼
    const backBtn = document.querySelector('#back-to-library-btn') as HTMLButtonElement;
    backBtn?.addEventListener('click', async () => {
        await hideMonitoringPage();
    });
    
    // 작업 중단 버튼
    const stopBtn = document.querySelector('#stop-operation-btn') as HTMLButtonElement;
    stopBtn?.addEventListener('click', async () => {
        await stopMonitoringOperation();
    });
    
    // Escape 키로 뒤로 가기
    document.addEventListener('keydown', async (e) => {
        if (e.key === 'Escape' && document.querySelector('.monitoring-container')) {
            await hideMonitoringPage();
        }
    });
}

/**
 * @brief 모니터링 작업 시작
 */
async function startMonitoringOperation(operationType: 'cleanup' | 'sync-scan'): Promise<void> {
    if (currentMonitoringOperation?.isRunning) {
        addMonitoringLog('warning', 'Another operation is already running');
        return;
    }
    
    // 필수 DOM 요소 존재 확인
    const stopBtn = document.querySelector('#stop-operation-btn') as HTMLButtonElement;
    const backBtn = document.querySelector('#back-to-library-btn') as HTMLButtonElement;
    const logContainer = document.querySelector('#terminal-log');
    
    if (!stopBtn || !backBtn || !logContainer) {
        console.error('[MONITOR] Required DOM elements not ready for monitoring page');
        return;
    }
    
    currentMonitoringOperation = {
        type: operationType,
        isRunning: true
    };
    
    // UI 상태 업데이트
    stopBtn.style.display = 'block';
    stopBtn.disabled = false;
    backBtn.style.display = 'block';
    backBtn.disabled = true;
    
    // 통계 패널 표시
    const statsPanel = document.querySelector('#monitoring-stats');
    if (statsPanel) {
        (statsPanel as HTMLElement).style.display = 'block';
    }
    
    try {
        const operationMessages = {
            'cleanup': 'orphaned records cleanup',
            'sync-scan': 'library synchronization scan',
            'library-scan': 'library scan'
        };
        addMonitoringLog('info', `Starting ${operationMessages[operationType]}...`);
        
        if (operationType === 'cleanup') {
            await executeCleanupOperation();
        } else if (operationType === 'sync-scan') {
            await executeSyncScanOperation();
        } else if (operationType === 'library-scan') {
            await executeLibraryScanOperation();
        }
        
    } catch (error) {
        addMonitoringLog('error', `Operation execution failed: ${error}`);
    } finally {
        currentMonitoringOperation = null;
        
        // UI 상태 복원
        if (stopBtn) stopBtn.disabled = true;
        if (backBtn) backBtn.disabled = false;
    }
}

/**
 * @brief 고아 레코드 정리 작업 실행
 */
async function executeCleanupOperation(): Promise<void> {
    try {
        const response = await fetch('http://localhost:8080/api/library/cleanup-orphaned', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            const cleaned = result.data?.cleaned_count || 0;
            addMonitoringLog('success', `Cleanup completed successfully: ${cleaned} orphaned records removed`);
            
            updateMonitoringStats({
                processed: cleaned,
                total: cleaned,
                progress: 100
            });
        } else {
            throw new Error(result.message || 'Unknown error occurred');
        }
        
    } catch (error) {
        addMonitoringLog('error', `Cleanup operation failed: ${error}`);
        throw error;
    }
}

/**
 * @brief 라이브러리 스캔 작업 실행
 */
async function executeLibraryScanOperation(): Promise<void> {
    try {
        // 라이브러리 스캔 시작
        const startResponse = await fetch('http://localhost:8080/api/library/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
            }
        });
        
        if (!startResponse.ok) {
            throw new Error(`HTTP ${startResponse.status}: ${startResponse.statusText}`);
        }
        
        const startResult = await startResponse.json();
        
        if (startResult.success) {
            addMonitoringLog('info', 'Library scan initiated');
            
            // 실시간 상태 모니터링 시작
            currentMonitoringOperation!.pollInterval = window.setInterval(async () => {
                await pollScanStatus();
            }, 1000);
            
        } else {
            throw new Error(startResult.message || 'Failed to start library scan');
        }
        
    } catch (error) {
        addMonitoringLog('error', `Library scan failed: ${error}`);
        throw error;
    }
}

/**
 * @brief 동기화 스캔 작업 실행
 */
async function executeSyncScanOperation(): Promise<void> {
    try {
        // 동기화 스캔 시작
        const startResponse = await fetch('http://localhost:8080/api/library/sync-scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
            }
        });
        
        if (!startResponse.ok) {
            throw new Error(`HTTP ${startResponse.status}: ${startResponse.statusText}`);
        }
        
        const startResult = await startResponse.json();
        
        if (startResult.success) {
            addMonitoringLog('info', 'Library synchronization scan initiated');
            
            // 실시간 상태 모니터링 시작
            currentMonitoringOperation!.pollInterval = window.setInterval(async () => {
                await pollScanStatus();
            }, 1000);
            
        } else {
            throw new Error(startResult.message || 'Failed to start synchronization scan');
        }
        
    } catch (error) {
        addMonitoringLog('error', `Synchronization scan failed: ${error}`);
        throw error;
    }
}

/**
 * @brief 스캔 상태 폴링
 */
async function pollScanStatus(): Promise<void> {
    if (!currentMonitoringOperation?.isRunning) {
        return;
    }
    
    try {
        const response = await fetch('http://localhost:8080/api/library/scan-status', {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            const status = result.data;
            
            // 진행률 업데이트
            updateMonitoringStats({
                processed: status.processed_books || 0,
                total: status.total_books || 0,
                progress: status.progress_percentage || 0,
                orphanedCleaned: status.orphaned_cleaned || 0
            });
            
            // 현재 처리 중인 도서 로그
            if (status.current_book && status.current_book.trim()) {
                addMonitoringLog('info', `Processing book: ${status.current_book}`);
            }
            
            // 에러 로그 표시
            if (status.errors && Array.isArray(status.errors) && status.errors.length > 0) {
                status.errors.forEach((error: string) => {
                    addMonitoringLog('error', error);
                });
            }
            
            // 스캔 완료 체크
            if (!status.is_scanning) {
                addMonitoringLog('success', 'Library synchronization scan completed successfully');
                
                if (status.orphaned_cleaned > 0) {
                    addMonitoringLog('info', `Cleanup completed: ${status.orphaned_cleaned} orphaned records removed`);
                }
                
                // 폴링 중단
                if (currentMonitoringOperation?.pollInterval) {
                    clearInterval(currentMonitoringOperation.pollInterval);
                    currentMonitoringOperation.pollInterval = undefined;
                }
                
                currentMonitoringOperation = null;
                
                // UI 상태 복원
                const stopBtn = document.querySelector('#stop-operation-btn') as HTMLButtonElement;
                const backBtn = document.querySelector('#back-to-library-btn') as HTMLButtonElement;
                if (stopBtn) stopBtn.disabled = true;
                if (backBtn) backBtn.disabled = false;
            }
        }
        
    } catch (error) {
        addMonitoringLog('error', `Status polling failed: ${error}`);
    }
}

/**
 * @brief 모니터링 작업 중단
 */
async function stopMonitoringOperation(): Promise<void> {
    if (!currentMonitoringOperation?.isRunning) {
        return;
    }
    
    try {
        addMonitoringLog('warning', 'Requesting operation termination...');
        
        // 폴링 중단
        if (currentMonitoringOperation.pollInterval) {
            clearInterval(currentMonitoringOperation.pollInterval);
            currentMonitoringOperation.pollInterval = undefined;
        }
        
        // 서버에 중단 요청
        const response = await fetch('http://localhost:8080/api/library/stop-scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
            }
        });
        
        if (response.ok) {
            addMonitoringLog('info', 'Operation terminated successfully');
        } else {
            addMonitoringLog('warning', 'Termination request sent but server response failed');
        }
        
    } catch (error) {
        addMonitoringLog('error', `Operation termination error: ${error}`);
    } finally {
        currentMonitoringOperation = null;
        
        // UI 상태 복원
        const stopBtn = document.querySelector('#stop-operation-btn') as HTMLButtonElement;
        const backBtn = document.querySelector('#back-to-library-btn') as HTMLButtonElement;
        if (stopBtn) stopBtn.disabled = true;
        if (backBtn) backBtn.disabled = false;
    }
}

/**
 * @brief 모니터링 로그 추가
 */
function addMonitoringLog(level: 'info' | 'success' | 'warning' | 'error', message: string): void {
    const logContainer = document.querySelector('#terminal-log');
    if (!logContainer) return;
    
    const timestamp = new Date().toISOString().substring(11, 23); // HH:mm:ss.SSS 형식
    const levelIcon = {
        'info': '[INFO]',
        'success': '[SUCCESS]', 
        'warning': '[WARN]',
        'error': '[ERROR]'
    }[level];
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${level}`;
    logEntry.innerHTML = `
        <span class="log-timestamp">${timestamp}</span>
        <span class="log-level">${levelIcon}</span>
        <span class="log-message">${message}</span>
    `;
    
    logContainer.appendChild(logEntry);
    
    // 자동 스크롤
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // 로그 개수 제한 (성능 최적화)
    const logs = logContainer.querySelectorAll('.log-entry');
    if (logs.length > 1000) {
        logs[0].remove();
    }
}

/**
 * @brief 모니터링 통계 업데이트
 */
function updateMonitoringStats(stats: {
    processed: number;
    total: number;
    progress: number;
    orphanedCleaned?: number;
}): void {
    // 진행률 바 업데이트
    const progressBar = document.querySelector('#progress-fill') as HTMLElement;
    const progressText = document.querySelector('#progress-text') as HTMLElement;
    
    if (progressBar && progressText) {
        progressBar.style.width = `${Math.min(stats.progress, 100)}%`;
        progressText.textContent = `${stats.processed}/${stats.total} (${Math.round(stats.progress)}%)`;
    }
    
    // 통계 수치 업데이트
    const processedEl = document.querySelector('#processed-count') as HTMLElement;
    const orphanedEl = document.querySelector('#orphaned-count') as HTMLElement;
    const orphanedStat = document.querySelector('#orphaned-stat') as HTMLElement;
    
    if (processedEl) processedEl.textContent = stats.processed.toString();
    
    // 고아 레코드 관련 통계는 값이 있을 때만 표시
    if (orphanedEl && stats.orphanedCleaned !== undefined && stats.orphanedCleaned > 0) {
        orphanedEl.textContent = stats.orphanedCleaned.toString();
        if (orphanedStat) orphanedStat.style.display = 'block';
    }
}

/**
 * @brief 모니터링 페이지 숨기기 및 정리
 */
async function hideMonitoringPage(): Promise<void> {
    // 실행 중인 작업이 있으면 중단
    if (currentMonitoringOperation?.isRunning) {
        if (confirm('실행 중인 작업이 있습니다. 중단하고 나가시겠습니까?')) {
            await stopMonitoringOperation();
        } else {
            return;
        }
    }
    
    // 원래 라이브러리 화면으로 복귀
    await showLibrary();
}