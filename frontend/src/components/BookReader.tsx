/**
 * @file components/BookReader.tsx
 * @brief Book reader component for EPUB/PDF/CBZ viewing
 * @author MyLibrary Team
 * @version 0.1.0
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

interface BookReaderProps {
  book: Book
  onBack: () => void
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
export default function BookReader({ book, onBack }: BookReaderProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [bookContent, setBookContent] = useState<string>('')
  const [progress, setProgress] = useState<ReadingProgress | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  
  const readerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLIFrameElement>(null)

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

        // Load reading progress
        const progressData = await progressApi.getProgress(book.id)
        setProgress(progressData)
        
        if (progressData?.page) {
          setCurrentPage(progressData.page)
        }

        // For demonstration, we'll simulate loading content
        // In a real implementation, this would integrate with EPUB.js, PDF.js, etc.
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        setTotalPages(Math.floor(Math.random() * 300) + 50) // Mock total pages
        setBookContent('Book content loaded...') // Mock content
        
      } catch (error) {
        setError(error instanceof Error ? error.message : '도서를 로드할 수 없습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    loadBook()
  }, [book.id])

  /**
   * Save reading progress
   */
  const saveProgress = async (page: number) => {
    try {
      await progressApi.updateProgress(book.id, { 
        page, 
        progress_percent: Math.round((page / totalPages) * 100)
      })
      setProgress(prev => prev ? { ...prev, page } : null)
    } catch (error) {
      console.error('Failed to save progress:', error)
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
          onBack()
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
            onClick={onBack}
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
            onClick={onBack}
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
            {/* Mock Reader Content */}
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6">{book.title}</h2>
              <div 
                style={{
                  fontSize: `${settings.fontSize}px`,
                  fontFamily: settings.fontFamily,
                  lineHeight: settings.lineHeight,
                  color: settings.textColor,
                  backgroundColor: settings.backgroundColor
                }}
              >
                <p className="mb-4">
                  페이지 {currentPage} / {totalPages}
                </p>
                <p className="mb-4">
                  이 영역에 실제 도서 내용이 표시됩니다. 
                  EPUB 파일의 경우 EPUB.js를, PDF 파일의 경우 PDF.js를, 
                  CBZ/CBR 파일의 경우 적절한 이미지 뷰어를 통합하여 
                  실제 도서 내용을 렌더링하게 됩니다.
                </p>
                <p className="mb-4">
                  현재는 데모 버전으로, 실제 구현에서는 각 파일 형식에 맞는 
                  전용 렌더링 엔진을 사용하여 도서를 표시합니다.
                </p>
                <p>
                  키보드 화살표 키나 상단의 네비게이션 버튼을 사용하여 
                  페이지를 이동할 수 있습니다.
                </p>
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
      </div>

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
