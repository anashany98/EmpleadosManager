import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

/**
 * Reusable loading spinner component
 * Standardizes all loading states across the app
 */
export function LoadingSpinner({ size = 'md', className = '', text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <Loader2 
        className={`animate-spin text-blue-600 ${sizeClasses[size]}`} 
        aria-hidden="true"
      />
      {text && (
        <p className={`text-slate-500 dark:text-slate-400 ${textSizeClasses[size]}`}>
          {text}
        </p>
      )}
      <span className="sr-only">Cargando...</span>
    </div>
  );
}

/**
 * Full page loading skeleton
 */
export function PageLoader({ text = 'Cargando datos...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

/**
 * Card skeleton for dashboard widgets
 */
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-xl ${className}`}>
      <div className="h-full w-full" />
    </div>
  );
}

/**
 * Table row skeleton
 */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}