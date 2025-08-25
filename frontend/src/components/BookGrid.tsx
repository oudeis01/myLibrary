/**
 * @file components/BookGrid.tsx
 * @brief Grid component for displaying book collection
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-26
 */

'use client'

import { Book } from '@/types'
import BookCard from './BookCard'

interface BookGridProps {
  books: Book[]
  onOpenBook: (bookId: number) => void
  onUpdateProgress: (bookId: number) => void
}

/**
 * Grid component for displaying books
 */
export default function BookGrid({ 
  books, 
  onOpenBook, 
  onUpdateProgress 
}: BookGridProps) {
  if (books.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1} 
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" 
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          아직 업로드된 책이 없습니다
        </h3>
        <p className="text-gray-500 mb-4">
          상단의 "도서 업로드" 탭에서 첫 번째 책을 추가해보세요!
        </p>
        <p className="text-sm text-gray-400">
          지원 형식: EPUB, PDF, CBZ, CBR
        </p>
      </div>
    )
  }

  return (
    <div className="book-grid">
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          onOpenBook={onOpenBook}
          onUpdateProgress={onUpdateProgress}
        />
      ))}
    </div>
  )
}
