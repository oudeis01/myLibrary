/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Strict Mode 비활성화 (개발 중 이슈 해결)
  reactStrictMode: false,
  
  // API 프록시 설정 (C++ 백엔드 연결)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
    ]
  },
  // 이미지 최적화
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8080',
        pathname: '/api/books/**',
      },
    ],
  },
  // TypeScript 엄격 모드
  typescript: {
    ignoreBuildErrors: false,
  },
  // 실험적 기능 (Next.js 15)
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // 정적 파일 서빙 최적화
  poweredByHeader: false,
}

module.exports = nextConfig
