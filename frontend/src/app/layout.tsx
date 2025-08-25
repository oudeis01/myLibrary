/**
 * @file app/layout.tsx
 * @brief Root layout component for MyLibrary Next.js application
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-26
 */

import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'MyLibrary - 개인 도서관 관리 시스템',
  description: '당신만의 디지털 도서관을 만들어보세요. EPUB, PDF, CBZ/CBR 파일을 지원하며 읽기 진행률을 추적합니다.',
  keywords: ['도서관', '전자책', 'EPUB', 'PDF', '독서', '진행률'],
  authors: [{ name: 'MyLibrary Team' }],
  creator: 'MyLibrary',
  publisher: 'MyLibrary',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#667eea',
}

interface RootLayoutProps {
  children: React.ReactNode
}

/**
 * Root layout component
 * @param children - Child components to render
 */
export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="ko" className={inter.variable} suppressHydrationWarning>
      <head>
        <meta name="application-name" content="MyLibrary" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MyLibrary" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#667eea" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#667eea" />
      </head>
      <body className={`${inter.className} antialiased min-h-screen bg-slate-50`} suppressHydrationWarning>
        <div className="flex flex-col min-h-screen">
          {children}
        </div>
      </body>
    </html>
  )
}
