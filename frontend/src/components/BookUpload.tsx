/**
 * @file components/BookUpload.tsx
 * @brief Book upload component with drag & drop and form
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-26
 */

'use client'

import { useState, useRef } from 'react'
import { Book } from '@/types'
import { bookApi } from '@/lib/api'
import LoadingSpinner from './LoadingSpinner'
import { Upload, File, CheckCircle, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BookUploadProps {
  onBookUploaded: (book: Book) => void
}

/**
 * Book upload component
 */
export default function BookUpload({ onBookUploaded }: BookUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supportedFormats = ['epub', 'pdf', 'cbz', 'cbr']
  const maxFileSize = 100 * 1024 * 1024 // 100MB

  /**
   * Validate file
   */
  const validateFile = (file: File): string | null => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    
    if (!fileExtension || !supportedFormats.includes(fileExtension)) {
      return `지원하지 않는 파일 형식입니다. (지원 형식: ${supportedFormats.join(', ').toUpperCase()})`
    }
    
    if (file.size > maxFileSize) {
      return '파일 크기가 100MB를 초과합니다.'
    }
    
    return null
  }

  /**
   * Extract title from filename
   */
  const extractTitleFromFilename = (filename: string): string => {
    const nameWithoutExtension = filename.replace(/\.[^/.]+$/, '')
    return nameWithoutExtension
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Handle file selection
   */
  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file)
    
    if (validationError) {
      setError(validationError)
      return
    }

    setSelectedFile(file)
    setError('')
    
    // Auto-fill title if not already set
    if (!title) {
      setTitle(extractTitleFromFilename(file.name))
    }
  }

  /**
   * Handle file input change
   */
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  /**
   * Handle drag over
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  /**
   * Handle drag leave
   */
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  /**
   * Handle drop
   */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  /**
   * Clear selected file
   */
  const clearFile = () => {
    setSelectedFile(null)
    setTitle('')
    setAuthor('')
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedFile) {
      setError('파일을 선택해주세요.')
      return
    }

    setIsUploading(true)
    setError('')
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      
      if (title.trim()) {
        formData.append('title', title.trim())
      }
      
      if (author.trim()) {
        formData.append('author', author.trim())
      }

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const uploadedBook = await bookApi.uploadBook(formData)
      
      clearInterval(progressInterval)
      setUploadProgress(100)
      
      // Success state
      setTimeout(() => {
        onBookUploaded(uploadedBook)
        clearFile()
        setUploadProgress(0)
      }, 500)
      
    } catch (error) {
      setError(error instanceof Error ? error.message : '업로드 중 오류가 발생했습니다.')
      setUploadProgress(0)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Drop Zone */}
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200",
            isDragOver
              ? "border-primary-400 bg-primary-50"
              : selectedFile
              ? "border-green-400 bg-green-50"
              : "border-gray-300 hover:border-gray-400"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".epub,.pdf,.cbz,.cbr"
            onChange={handleFileInputChange}
            disabled={isUploading}
          />

          {selectedFile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={clearFile}
                disabled={isUploading}
                className="inline-flex items-center space-x-2 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                <span>다른 파일 선택</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <Upload className="w-12 h-12 text-gray-400" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">
                  파일을 드래그하거나 클릭하여 선택
                </p>
                <p className="text-sm text-gray-500">
                  지원 형식: EPUB, PDF, CBZ, CBR (최대 100MB)
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors duration-200"
              >
                <File className="w-4 h-4" />
                <span>파일 선택</span>
              </button>
            </div>
          )}
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <LoadingSpinner size="small" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">업로드 중...</p>
                <div className="w-full bg-blue-200 rounded-full h-2 mt-1">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
              <span className="text-sm text-blue-700">{uploadProgress}%</span>
            </div>
          </div>
        )}

        {/* Metadata Fields */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="text-lg font-medium text-gray-900">도서 정보</h3>
          
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              제목 (선택사항)
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isUploading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
              placeholder="파일명에서 자동 추출됩니다"
            />
          </div>

          <div>
            <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-1">
              저자 (선택사항)
            </label>
            <input
              type="text"
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              disabled={isUploading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
              placeholder="저자명을 입력하세요"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!selectedFile || isUploading}
            className={cn(
              "px-6 py-3 rounded-lg font-medium transition-colors duration-200",
              "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500",
              selectedFile && !isUploading
                ? "bg-primary-500 hover:bg-primary-600 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            )}
          >
            {isUploading ? (
              <div className="flex items-center space-x-2">
                <LoadingSpinner size="small" />
                <span>업로드 중...</span>
              </div>
            ) : (
              '도서 업로드'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
