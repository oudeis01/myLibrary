import './style.css';

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
        console.log('Login response:', result);
        
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
        console.error('Login error:', error);
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
    console.log('Books response:', result);
    
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
              <div class="cover-placeholder">📖</div>
            </div>
            <div class="book-info">
              <div class="book-title">${getDisplayTitle(book.title, book.file_path, index)}</div>
              <div class="book-author">${book.author && book.author !== 'Unknown Author' ? book.author : ''}</div>
              <div class="book-meta">
                <span>${book.format?.toUpperCase() || 'UNKNOWN'}</span>
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
    console.error('Failed to load books:', error);
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
      console.log('Opening reader for book:', bookId);
      await openBookReader(parseInt(bookId));
    } else if (target.classList.contains('download-btn')) {
      console.log('Downloading book for offline:', bookId);
      await downloadBookForOffline(parseInt(bookId), target as HTMLButtonElement);
    }
  });
}

async function openBookReader(bookId: number) {
  const token = localStorage.getItem('sessionToken');
  if (!token) return;
  
  try {
    // 책 파일 다운로드
    console.log('Downloading book file...');
    const response = await fetch(`http://localhost:8080/api/books/${bookId}/file`, {
      headers: {
        'X-Session-Token': token,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download book: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log('Book downloaded, size:', arrayBuffer.byteLength);
    
    // 간단한 리더 모달 표시
    showSimpleReader(bookId, arrayBuffer);
    
  } catch (error) {
    console.error('Failed to open reader:', error);
    const status = document.querySelector('#status') as HTMLDivElement;
    if (status) {
      status.textContent = `Failed to open book: ${error}`;
      status.className = 'status error';
    }
  }
}

function showSimpleReader(bookId: number, data: ArrayBuffer) {
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