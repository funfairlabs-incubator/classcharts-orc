'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number; // px to pull before triggering, default 80
}

export function usePullToRefresh({ onRefresh, threshold = 80 }: PullToRefreshOptions) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only trigger when scrolled to top
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (startY.current === null || refreshing) return;
    const dist = e.touches[0].clientY - startY.current;
    if (dist > 0 && window.scrollY === 0) {
      setPulling(true);
      setPullDistance(Math.min(dist * 0.5, threshold * 1.2)); // dampen
      if (dist > 10) e.preventDefault(); // prevent scroll
    }
  }, [refreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    if (pullDistance >= threshold) {
      setRefreshing(true);
      try { await onRefresh(); } finally {
        setRefreshing(false);
      }
    }
    setPulling(false);
    setPullDistance(0);
    startY.current = null;
  }, [pulling, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { pulling, pullDistance, refreshing, threshold };
}

// Visual indicator component
export function PullToRefreshIndicator({
  pulling, pullDistance, refreshing, threshold,
}: {
  pulling: boolean; pullDistance: number; refreshing: boolean; threshold: number;
}) {
  if (!pulling && !refreshing) return null;
  const progress = Math.min(pullDistance / threshold, 1);
  const ready = progress >= 1;

  return (
    <div style={{
      position: 'fixed',
      top: 52, // below nav bar
      left: '50%',
      transform: `translateX(-50%) translateY(${refreshing ? 0 : pullDistance - 40}px)`,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: 'var(--surface)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      border: '1px solid var(--border)',
      transition: refreshing ? 'transform 0.2s' : 'none',
    }}>
      {refreshing ? (
        <div style={{
          width: 16, height: 16,
          border: '2px solid var(--border)',
          borderTopColor: 'var(--accent, #6366f1)',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }} />
      ) : (
        <div style={{
          fontSize: 16,
          transform: `rotate(${ready ? 180 : progress * 180}deg)`,
          transition: 'transform 0.1s',
          color: ready ? 'var(--accent, #6366f1)' : 'var(--text-3)',
        }}>↓</div>
      )}
    </div>
  );
}
