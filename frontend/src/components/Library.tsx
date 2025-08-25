/**
 * @file components/Library.tsx
 * @brief Main library component with books management and reader
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-26
 */

'use client'

import { useState, useEffect } from 'react'
import { Book } from '@/types'
import { bookApi } from '@/lib/api'
import BookCard from './BookCard'
import BookUpload from './BookUpload'
import BookReader from './BookReader'
import LoadingSpinner from './LoadingSpinner'
import { 
  BookOpen, 
  Upload, 
  LogOut, 
  User,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LibraryProps {
  username: string
  onLogout: () => void
}

type TabType = 'books' | 'upload' | 'reader'

/**
 * Main library component
 */
export default function Library({ username, onLogout }: LibraryProps) {
  const [activeTab, setActiveTab] = useState<TabType>('books')
  const [books, setBooks] = useState<Book[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentBookId, setCurrentBookId] = useState<number | null>(null)

  /**
   * Load books from API
   */
  const loadBooks = async () => {
    try {
      setIsLoading(true)
      setError('')
      const booksData = await bookApi.getBooks()
      setBooks(booksData)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '책 목록을 불러오는 중 오류가 발생했습니다.'
      setError(errorMessage)
      console.error('Error loading books:', error)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Load books on component mount
   */
  useEffect(() => {
    loadBooks()
  }, [])

  /**
   * Handle book upload success
   */
  const handleBookUploaded = (newBook: Book) => {
    setBooks(prev => [newBook, ...prev])
    setActiveTab('books')
  }

  /**
   * Handle opening a book for reading
   */
  const handleOpenBook = (bookId: number) => {
    setCurrentBookId(bookId)
    setActiveTab('reader')
  }

  /**
   * Handle closing the reader
   */
  const handleCloseReader = () => {
    setCurrentBookId(null)
    setActiveTab('books')
    // Refresh books to update progress
    loadBooks()
  }

  /**
   * Handle progress update
   */
  const handleProgressUpdate = async (bookId: number) => {
    // Refresh books to show updated progress
    await loadBooks()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary-500 rounded-lg text-white">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">MyLibrary</h1>
                <p className="text-sm text-gray-500">개인 도서관</p>
              </div>
            </div>

            {/* User Info and Actions */}
            <div className="flex items-center space-x-4">
              <button
                onClick={loadBooks}
                disabled={isLoading}
                className={cn(
                  "p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100",
                  "transition-colors duration-200",
                  isLoading && "animate-spin"
                )}
                title="새로고침"
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-2 text-sm text-gray-700">
                <User className="w-4 h-4" />
                <span>{username}</span>
              </div>

              <button
                onClick={onLogout}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      {activeTab !== 'reader' && (
        <nav className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab('books')}
                className={cn(
                  "flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200",
                  activeTab === 'books'
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <BookOpen className="w-4 h-4" />
                <span>내 도서</span>
                <span className="bg-gray-100 text-gray-600 py-1 px-2 rounded-full text-xs">
                  {books.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('upload')}
                className={cn(
                  "flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200",
                  activeTab === 'upload'
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <Upload className="w-4 h-4" />
                <span>도서 업로드</span>
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">오류</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button
                  onClick={loadBooks}
                  className="mt-2 text-sm font-medium text-red-800 hover:text-red-900 underline"
                >
                  다시 시도
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'books' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">도서 목록</h2>
              <p className="text-sm text-gray-500">
                총 {books.length}권의 책
              </p>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="large" text="도서 목록을 불러오는 중..." />
              </div>
            ) : (
              <div className="book-grid">
                {books.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onOpenBook={handleOpenBook}
                    onUpdateProgress={handleProgressUpdate}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">도서 업로드</h2>
            <BookUpload onBookUploaded={handleBookUploaded} />
          </div>
        )}

        {activeTab === 'reader' && currentBookId && (
          <BookReader
            bookId={currentBookId}
            books={books}
            onClose={handleCloseReader}
            onProgressUpdate={handleProgressUpdate}
          />
        )}
      </main>
    </div>
  )
}
