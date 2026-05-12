import { useState, useEffect } from 'react';
import { WifiOff, X } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

/**
 * Global offline banner component
 * Shows when user loses internet connection
 */
export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      setDismissed(false);
    }
  }, [isOnline]);

  if (isOnline || dismissed) return null;

  return (
    <div 
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-500 dark:bg-amber-600 text-white rounded-xl shadow-lg">
        <WifiOff size={20} className="shrink-0" aria-hidden="true" />
        <div className="text-sm font-medium">
          Sin conexión a internet
        </div>
        <button 
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}