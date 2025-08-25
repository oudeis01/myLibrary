/**
 * @file lib/utils.ts
 * @brief Utility functions for MyLibrary frontend
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-26
 */

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combine class names with Tailwind merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format date in readable format
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get file type icon
 */
export function getFileTypeIcon(fileType: string): string {
  switch (fileType) {
    case 'epub':
      return '📚';
    case 'pdf':
      return '📄';
    case 'cbz':
    case 'cbr':
      return '🎭';
    default:
      return '📖';
  }
}

/**
 * Get file type color
 */
export function getFileTypeColor(fileType: string): string {
  switch (fileType) {
    case 'epub':
      return 'from-blue-500 to-purple-600';
    case 'pdf':
      return 'from-pink-500 to-red-500';
    case 'cbz':
    case 'cbr':
      return 'from-cyan-500 to-blue-500';
    default:
      return 'from-orange-300 to-orange-500';
  }
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Check if running in browser
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Local storage helpers
 */
export const storage = {
  get: (key: string) => {
    if (!isBrowser()) return null;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },
  
  set: (key: string, value: any) => {
    if (!isBrowser()) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Silent fail
    }
  },
  
  remove: (key: string) => {
    if (!isBrowser()) return;
    localStorage.removeItem(key);
  },
};
