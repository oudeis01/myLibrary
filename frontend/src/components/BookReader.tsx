/**
 * @file components/BookReader.tsx
 * @brief Book reader component for EPUB/PDF/CBZ viewing with actual file support
 * @author MyLibrary Team
 * @version 0.2.0
 * @date 2025-08-26
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { Book, ReadingProgress } from '@/types'
import { bookApi, progressApi } from '@/lib/api'
import LoadingSpinner from './LoadingSpinner'
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowLeft, 
  Settings, 
  Bookmark, 
  ZoomIn, 
  ZoomOut,
  RotateCw,
  Menu
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Import libraries for file processing (will be installed)
// import ePub from 'epubjs'
// import * as pdfjsLib from 'pdfjs-dist'
// import JSZip from 'jszip'

// Set PDF.js worker (will be enabled after install)
// pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`

/**
 * File type enum for different book formats
 */
enum FileType {
  EPUB = 'epub',
  PDF = 'pdf', 
  CBZ = 'cbz',
  CBR = 'cbr',
  ZIP = 'zip'
}

interface BookReaderProps {
  bookId: number
  books: Book[]
  onClose: () => void
  onProgressUpdate: (bookId: number) => void
}

interface ReaderSettings {
  fontSize: number
  fontFamily: string
  lineHeight: number
  backgroundColor: string
  textColor: string
  pageWidth: number
}

/**
 * Book reader component
 */
export default function BookReader({ 
  bookId, 
  books, 
  onClose, 
  onProgressUpdate 
}: BookReaderProps) {
  // Find the current book from the books array
  const book = books.find(b => b.id === bookId)
  
  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">도서를 찾을 수 없습니다.</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [bookContent, setBookContent] = useState<string>('')
  const [progress, setProgress] = useState<ReadingProgress | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [error, setError] = useState('')
  
  // File-specific states
  const [fileType, setFileType] = useState<FileType | null>(null)
  const [pagesData, setPagesData] = useState<string[]>([]) // For images (CBZ/CBR)
  const [pdfDocument, setPdfDocument] = useState<any>(null) // For PDF
  const [epubBook, setEpubBook] = useState<any>(null) // For EPUB
  
  // Refs for rendering
  const viewerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  
  const readerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLIFrameElement>(null)

  /**
   * Determine file type from filename
   */
  const getFileType = (filename: string): FileType | null => {
    const extension = filename.toLowerCase().split('.').pop()
    switch (extension) {
      case 'epub':
        return FileType.EPUB
      case 'pdf':
        return FileType.PDF
      case 'cbz':
      case 'zip':
        return FileType.CBZ
      case 'cbr':
        return FileType.CBR
      default:
        return null
    }
  }

  /**
   * Load EPUB file content
   */
  const loadEpubFile = async (fileUrl: string) => {
    console.log('📚 Loading EPUB file:', fileUrl)
    try {
      // TODO: Implement EPUB.js integration
      // const book = ePub(fileUrl)
      // await book.ready
      // setEpubBook(book)
      // setTotalPages(book.spine.length)
      
      // Temporary placeholder
      setTotalPages(150)
      setBookContent(`
        <div class="epub-content">
          <h1>EPUB 도서</h1>
          <p>현재 페이지: ${currentPage}</p>
          <p>EPUB 파일 로딩이 구현될 예정입니다.</p>
          <p>파일: ${book.file_path}</p>
        </div>
      `)
    } catch (error) {
      throw new Error('EPUB 파일을 로드할 수 없습니다: ' + error)
    }
  }

  /**
   * Load PDF file content  
   */
  const loadPdfFile = async (fileUrl: string) => {
    console.log('📄 Loading PDF file:', fileUrl)
    try {
      // TODO: Implement PDF.js integration
      // const pdf = await pdfjsLib.getDocument(fileUrl).promise
      // setPdfDocument(pdf)
      // setTotalPages(pdf.numPages)
      // await renderPdfPage(currentPage)
      
      // Temporary placeholder
      setTotalPages(45)
      setBookContent(`
        <div class="pdf-content">
          <h1>PDF 도서</h1>
          <p>현재 페이지: ${currentPage}</p>
          <p>PDF 파일 로딩이 구현될 예정입니다.</p>
          <p>파일: ${book.file_path}</p>
        </div>
      `)
    } catch (error) {
      throw new Error('PDF 파일을 로드할 수 없습니다: ' + error)
    }
  }

  /**
   * Load CBZ/CBR file content (comic book archives)
   */
  const loadComicFile = async (fileUrl: string) => {
    console.log('🎨 Loading Comic file:', fileUrl)
    try {
      // TODO: Implement JSZip integration for CBZ/ZIP files
      // const response = await fetch(fileUrl)
      // const arrayBuffer = await response.arrayBuffer()
      // const zip = new JSZip()
      // const contents = await zip.loadAsync(arrayBuffer)
      // const imageFiles = []
      // 
      // contents.forEach((relativePath, file) => {
      //   if (file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      //     imageFiles.push(file)
      //   }
      // })
      // 
      // imageFiles.sort((a, b) => a.name.localeCompare(b.name))
      // setTotalPages(imageFiles.length)
      // 
      // const imageDataUrls = await Promise.all(
      //   imageFiles.map(async (file) => {
      //     const blob = await file.async('blob')
      //     return URL.createObjectURL(blob)
      //   })
      // )
      // setPagesData(imageDataUrls)
      
      // Temporary placeholder
      setTotalPages(25)
      setPagesData([
        '/api/placeholder-comic-page.jpg', // 플레이스홀더 이미지
        '/api/placeholder-comic-page.jpg',
        '/api/placeholder-comic-page.jpg'
      ])
      setBookContent(`
        <div class="comic-content">
          <h1>만화책 (CBZ/CBR)</h1>
          <p>현재 페이지: ${currentPage}</p>
          <p>만화책 파일 로딩이 구현될 예정입니다.</p>
          <p>파일: ${book.file_path}</p>
        </div>
      `)
    } catch (error) {
      throw new Error('만화책 파일을 로드할 수 없습니다: ' + error)
    }
  }

  const [settings, setSettings] = useState<ReaderSettings>({
    fontSize: 16,
    fontFamily: 'Georgia',
    lineHeight: 1.6,
    backgroundColor: '#ffffff',
    textColor: '#000000',
    pageWidth: 800
  })

  /**
   * Load book content and progress
   */
  useEffect(() => {
    const loadBook = async () => {
      try {
        setIsLoading(true)
        setError('')

        // Determine file type
        const detectedFileType = getFileType(book.file_path)
        setFileType(detectedFileType)

        // Load reading progress FIRST
        const progressData = await progressApi.getProgress(book.id)
        setProgress(progressData)
        
        // Set initial page from progress (important for correct position)
        const initialPage = progressData?.page || 1
        setCurrentPage(initialPage)

        // Get file URL for loading
        const fileUrl = `/api/books/${book.id}/file`
        
        // Load content based on file type
        switch (detectedFileType) {
          case FileType.EPUB:
            await loadEpubFile(fileUrl)
            break
          case FileType.PDF:
            await loadPdfFile(fileUrl)
            break
          case FileType.CBZ:
          case FileType.CBR:
            await loadComicFile(fileUrl)
            break
          default:
            throw new Error(`지원하지 않는 파일 형식입니다: ${book.file_type}`)
        }
        
      } catch (error) {
        setError(error instanceof Error ? error.message : '도서를 로드할 수 없습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    loadBook()
  }, [book.id])

  /**
   * Save reading progress and update parent component
   */
  const saveProgress = async (page: number) => {
    try {
      await progressApi.updateProgress(book.id, { 
        page, 
        progress_percent: Math.round((page / totalPages) * 100)
      })
      setProgress(prev => prev ? { ...prev, page } : null)
      
      // Notify parent component to update progress
      onProgressUpdate(book.id)
    } catch (error) {
      console.error('Failed to save progress:', error)
    }
  }

  /**
   * Render current page based on file type
   */
  const renderCurrentPage = () => {
    switch (fileType) {
      case FileType.EPUB:
        return (
          <div 
            className="epub-page prose max-w-none"
            style={{
              fontSize: `${settings.fontSize}px`,
              fontFamily: settings.fontFamily,
              lineHeight: settings.lineHeight,
              backgroundColor: settings.backgroundColor,
              color: settings.textColor,
              maxWidth: `${settings.pageWidth}px`,
              margin: '0 auto',
              padding: '2rem'
            }}
            dangerouslySetInnerHTML={{ __html: bookContent }}
          />
        )
      
      case FileType.PDF:
        return (
          <div className="pdf-page flex justify-center">
            <canvas 
              ref={canvasRef}
              className="max-w-full h-auto shadow-lg"
              style={{ backgroundColor: settings.backgroundColor }}
            />
            {/* Fallback content */}
            <div 
              className="pdf-fallback p-8"
              dangerouslySetInnerHTML={{ __html: bookContent }}
            />
          </div>
        )
      
      case FileType.CBZ:
      case FileType.CBR:
        return (
          <div className="comic-page flex justify-center items-center">
            {pagesData[currentPage - 1] ? (
              <img 
                src={pagesData[currentPage - 1]}
                alt={`Page ${currentPage}`}
                className="max-w-full max-h-[80vh] object-contain shadow-lg"
                style={{ backgroundColor: settings.backgroundColor }}
              />
            ) : (
              <div 
                className="comic-fallback p-8"
                dangerouslySetInnerHTML={{ __html: bookContent }}
              />
            )}
          </div>
        )
      
      default:
        return (
          <div className="unsupported-file flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-600">지원하지 않는 파일 형식입니다.</p>
              <p className="text-gray-500">{book.file_type}</p>
            </div>
          </div>
        )
    }
  }

  /**
   * Navigate to previous page
   */
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1
      setCurrentPage(newPage)
      saveProgress(newPage)
    }
  }

  /**
   * Navigate to next page
   */
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1
      setCurrentPage(newPage)
      saveProgress(newPage)
    }
  }

  /**
   * Go to specific page
   */
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      saveProgress(page)
    }
  }

  /**
   * Handle zoom in
   */
  const zoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 300))
  }

  /**
   * Handle zoom out
   */
  const zoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50))
  }

  /**
   * Handle rotation
   */
  const rotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  /**
   * Toggle bookmark
   */
  const toggleBookmark = async () => {
    try {
      // In a real implementation, this would save/remove bookmarks
      console.log(`Bookmark toggled for page ${currentPage}`)
    } catch (error) {
      console.error('Failed to toggle bookmark:', error)
    }
  }

  /**
   * Apply reader settings to content
   */
  const applySettings = () => {
    if (contentRef.current?.contentDocument) {
      const doc = contentRef.current.contentDocument
      const body = doc.body
      
      if (body) {
        body.style.fontSize = `${settings.fontSize}px`
        body.style.fontFamily = settings.fontFamily
        body.style.lineHeight = settings.lineHeight.toString()
        body.style.backgroundColor = settings.backgroundColor
        body.style.color = settings.textColor
        body.style.maxWidth = `${settings.pageWidth}px`
        body.style.margin = '0 auto'
        body.style.padding = '2rem'
      }
    }
  }

  /**
   * Handle keyboard navigation
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          goToPreviousPage()
          break
        case 'ArrowRight':
          e.preventDefault()
          goToNextPage()
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, totalPages])

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoadingSpinner size="large" />
          <p className="text-lg text-gray-600">도서를 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-red-500 text-6xl">⚠️</div>
          <h2 className="text-2xl font-semibold text-gray-900">로딩 오류</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onClose}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>뒤로</span>
          </button>
          <div className="hidden md:block">
            <h1 className="text-lg font-semibold text-gray-900">{book.title}</h1>
            <p className="text-sm text-gray-500">{book.author}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Page Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage <= 1}
              className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={currentPage}
                onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-1 text-center border border-gray-300 rounded"
                min={1}
                max={totalPages}
              />
              <span className="text-gray-600">/ {totalPages}</span>
            </div>
            
            <button
              onClick={goToNextPage}
              disabled={currentPage >= totalPages}
              className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Reader Controls */}
          <div className="flex items-center space-x-1 border-l border-gray-200 pl-2">
            <button
              onClick={zoomOut}
              className="p-2 text-gray-600 hover:text-gray-900"
              title="축소"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            
            <span className="text-sm text-gray-600 min-w-[3rem] text-center">
              {zoom}%
            </span>
            
            <button
              onClick={zoomIn}
              className="p-2 text-gray-600 hover:text-gray-900"
              title="확대"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            
            <button
              onClick={rotate}
              className="p-2 text-gray-600 hover:text-gray-900"
              title="회전"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-1 border-l border-gray-200 pl-2">
            <button
              onClick={toggleBookmark}
              className="p-2 text-gray-600 hover:text-gray-900"
              title="북마크"
            >
              <Bookmark className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-600 hover:text-gray-900"
              title="설정"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Reader Content */}
      <div className="flex-1 relative overflow-hidden">
        <div 
          ref={readerRef}
          className="h-full flex items-center justify-center p-4 bg-gray-100"
        >
          <div 
            className="bg-white shadow-2xl rounded-lg overflow-hidden"
            style={{ 
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: 'transform 0.3s ease',
              width: `${settings.pageWidth}px`,
              minHeight: '80vh'
            }}
          >
            {/* Book Content */}
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6">{book.title}</h2>
              {renderCurrentPage()}
            </div>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="absolute top-0 right-0 w-80 h-full bg-white border-l border-gray-200 shadow-lg p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">읽기 설정</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Font Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  글자 크기: {settings.fontSize}px
                </label>
                <input
                  type="range"
                  min={12}
                  max={24}
                  value={settings.fontSize}
                  onChange={(e) => setSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>

              {/* Font Family */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  글꼴
                </label>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => setSettings(prev => ({ ...prev, fontFamily: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="Georgia">Georgia</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Verdana">Verdana</option>
                </select>
              </div>

              {/* Line Height */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  줄 간격: {settings.lineHeight}
                </label>
                <input
                  type="range"
                  min={1.2}
                  max={2.0}
                  step={0.1}
                  value={settings.lineHeight}
                  onChange={(e) => setSettings(prev => ({ ...prev, lineHeight: parseFloat(e.target.value) }))}
                  className="w-full"
                />
              </div>

              {/* Background Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  배경색
                </label>
                <div className="flex space-x-2">
                  {['#ffffff', '#f5f5f5', '#f0f8ff', '#fefcf3', '#1a1a1a'].map(color => (
                    <button
                      key={color}
                      onClick={() => setSettings(prev => ({ 
                        ...prev, 
                        backgroundColor: color,
                        textColor: color === '#1a1a1a' ? '#ffffff' : '#000000'
                      }))}
                      className={cn(
                        "w-8 h-8 rounded border-2",
                        settings.backgroundColor === color ? "border-primary-500" : "border-gray-300"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {progress && (
          <div className="bg-white border-t border-gray-200 px-4 py-2">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>읽기 진행률</span>
              <span>{Math.round((currentPage / totalPages) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentPage / totalPages) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
  )
}
