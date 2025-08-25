/**
 * @file components/BookCard.tsx
 * @brief Individual book card component with thumbnail and actions
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-26
 */

'use client'

import { Book } from '@/types'
import { formatFileSize, formatDate, getFileTypeIcon, getFileTypeColor } from '@/lib/utils'
import { BookOpen, BarChart3, Download } from 'lucide-react'
import { bookApi } from '@/lib/api'
import { cn } from '@/lib/utils'

interface BookCardProps {
  book: Book
  onOpenBook: (bookId: number) => void
  onUpdateProgress: (bookId: number) => void
}

/**
 * Individual book card component
 */
export default function BookCard({ 
  book, 
  onOpenBook, 
  onUpdateProgress 
}: BookCardProps) {
  const progressPercent = book.progress?.progress_percent || 0
  const lastPage = book.progress?.page || 0
  const totalPages = book.progress?.total_pages || 0

  /**
   * Handle download button click
   */
  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = bookApi.getBookDownloadUrl(book.id)
    link.download = `${book.title}.${book.file_type}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden group">
      {/* Book Thumbnail */}
      <div className="relative">
        <div className={cn(
          "w-full h-48 flex flex-col items-center justify-center text-white relative",
          "bg-gradient-to-br",
          getFileTypeColor(book.file_type)
        )}>
          {/* File Type Icon */}
          <div className="text-4xl mb-2">
            {getFileTypeIcon(book.file_type)}
          </div>
          
          {/* File Format Badge */}
          <div className="absolute top-2 right-2 bg-black bg-opacity-20 px-2 py-1 rounded text-xs font-medium">
            {book.file_type.toUpperCase()}
          </div>

          {/* Progress Overlay */}
          {progressPercent > 0 && (
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-20 p-2">
              <div className="w-full bg-white bg-opacity-30 rounded-full h-1.5">
                <div 
                  className="bg-white h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Book Info */}
      <div className="p-4">
        {/* Title and Author */}
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900 text-lg line-clamp-2 mb-1">
            {book.title}
          </h3>
          <p className="text-gray-600 text-sm">
            {book.author || '저자 미상'}
          </p>
        </div>

        {/* Metadata */}
        <div className="text-xs text-gray-500 mb-3 space-y-1">
          <div className="flex items-center justify-between">
            <span>파일 크기</span>
            <span>{formatFileSize(book.file_size)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>업로드</span>
            <span>{formatDate(book.uploaded_at)}</span>
          </div>
        </div>

        {/* Progress Info */}
        {book.progress ? (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>읽기 진행률</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {lastPage > 0 && totalPages > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {lastPage} / {totalPages} 페이지
              </p>
            )}
          </div>
        ) : (
          <div className="mb-4">
            <p className="text-sm text-gray-500 italic">아직 읽지 않음</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <button
            onClick={() => onOpenBook(book.id)}
            className="flex-1 flex items-center justify-center space-x-2 bg-primary-500 hover:bg-primary-600 text-white py-2 px-3 rounded-lg transition-colors duration-200 text-sm font-medium"
          >
            <BookOpen className="w-4 h-4" />
            <span>읽기</span>
          </button>

          <button
            onClick={() => onUpdateProgress(book.id)}
            className="flex items-center justify-center space-x-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-lg transition-colors duration-200 text-sm"
            title="진행률 업데이트"
          >
            <BarChart3 className="w-4 h-4" />
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center justify-center space-x-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-lg transition-colors duration-200 text-sm"
            title="다운로드"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
