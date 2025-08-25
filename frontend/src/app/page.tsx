/**
 * @file app/page.tsx
 * @brief Main page component for MyLibrary application
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-26
 */

'use client'

import { useEffect, useState } from 'react'
import { authApi, getSessionToken } from '@/lib/api'
import LoginForm from '@/components/LoginForm'
import Library from '@/components/Library'
import LoadingSpinner from '@/components/LoadingSpinner'

/**
 * Main application page
 */
export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null) // null = loading
  const [username, setUsername] = useState<string>('')

  useEffect(() => {
    console.log('🔄 useEffect triggered')
    
    // 이미 인증 상태가 설정되었으면 중복 실행 방지
    if (isAuthenticated !== null) {
      console.log('⚠️ useEffect already executed, skipping')
      return
    }
    
    // Check for existing session
    const token = getSessionToken()
    const savedUsername = localStorage.getItem('username')
    
    console.log('🔍 Authentication check:', { 
      token: token ? `${token.substring(0, 10)}...` : null, 
      savedUsername 
    })
    
    if (token && savedUsername) {
      console.log('✅ User authenticated')
      setIsAuthenticated(true)
      setUsername(savedUsername)
    } else {
      console.log('❌ User not authenticated')
      setIsAuthenticated(false)
      setUsername('')
    }
  }, [isAuthenticated])

  /**
   * Handle successful login
   */
  const handleLoginSuccess = (username: string, token: string) => {
    console.log('🎉 Login success:', { username, token: token ? `${token.substring(0, 10)}...` : null });
    
    // 토큰은 이미 api.ts에서 저장됨
    localStorage.setItem('username', username)
    setUsername(username)
    setIsAuthenticated(true)
    
    // 즉시 확인
    setTimeout(() => {
      console.log('🔍 After login storage check:', {
        sessionToken: localStorage.getItem('sessionToken'),
        username: localStorage.getItem('username')
      });
    }, 100);
  }

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('username')
      setIsAuthenticated(false)
      setUsername('')
    }
  }

  console.log('🎨 Rendering:', { isAuthenticated, username })

  // null means still loading
  if (isAuthenticated === null) {
    console.log('⏳ Showing loading spinner')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  return (
    <main className="min-h-screen">
      {isAuthenticated === true ? (
        <>
          {console.log('📚 Rendering Library component')}
          <Library username={username} onLogout={handleLogout} />
        </>
      ) : (
        <>
          {console.log('🔐 Rendering LoginForm component')}
          <LoginForm onLoginSuccess={handleLoginSuccess} />
        </>
      )}
    </main>
  )
}
