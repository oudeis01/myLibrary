/**
 * @file components/LoadingSpinner.tsx
 * @brief Loading spinner component
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-26
 */

import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  className?: string
  text?: string
}

/**
 * Loading spinner component
 */
export default function LoadingSpinner({ 
  size = 'medium', 
  className,
  text 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
  }

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <div 
        className={cn(
          'animate-spin rounded-full border-2 border-slate-300 border-t-primary-500',
          sizeClasses[size]
        )}
      />
      {text && (
        <p className="mt-2 text-sm text-slate-600">{text}</p>
      )}
    </div>
  )
}
