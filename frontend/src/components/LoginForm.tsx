/**
 * @file components/LoginForm.tsx
 * @brief Login and registration form component
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-26
 */

'use client'

import { useState } from 'react'
import { authApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import LoadingSpinner from './LoadingSpinner'
import { BookOpen, User, Lock, Eye, EyeOff } from 'lucide-react'

interface LoginFormProps {
  onLoginSuccess: (username: string, token: string) => void
}

/**
 * Login and registration form component
 */
export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = isLogin 
        ? await authApi.login(formData.username, formData.password)
        : await authApi.register(formData.username, formData.password)
      
      onLoginSuccess(response.username, response.session_token)
    } catch (error) {
      setError(error instanceof Error ? error.message : '오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle input change
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary-500 text-white mb-4">
            <BookOpen className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            MyLibrary
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isLogin ? '계정에 로그인하세요' : '새 계정을 만드세요'}
          </p>
        </div>

        {/* Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="sr-only">
                사용자명
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className={cn(
                    "block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md",
                    "placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500",
                    "focus:border-primary-500 sm:text-sm"
                  )}
                  placeholder="사용자명"
                  value={formData.username}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="sr-only">
                비밀번호
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  className={cn(
                    "block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md",
                    "placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500",
                    "focus:border-primary-500 sm:text-sm"
                  )}
                  placeholder="비밀번호"
                  value={formData.password}
                  onChange={handleInputChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  "group relative w-full flex justify-center py-2 px-4 border border-transparent",
                  "text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700",
                  "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <LoadingSpinner size="small" />
                ) : (
                  isLogin ? '로그인' : '회원가입'
                )}
              </button>
            </div>

            {/* Toggle Mode */}
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-primary-600 hover:text-primary-500"
                onClick={() => {
                  setIsLogin(!isLogin)
                  setError('')
                  setFormData({ username: '', password: '' })
                }}
              >
                {isLogin ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
              </button>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500">
          <p>MyLibrary v0.1.0 - 개인 도서관 관리 시스템</p>
        </div>
      </div>
    </div>
  )
}
