"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { haptic } from "../lib/haptics";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
}

export function PullToRefresh({ onRefresh, children, threshold = 72 }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (startY.current === null || refreshing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) { startY.current = null; return; }

    const dist = Math.max(0, e.touches[0].clientY - startY.current);
    const dampened = Math.min(dist * 0.45, threshold * 1.4);
    setPullDistance(dampened);

    if (dampened >= threshold && !triggered) {
      setTriggered(true);
      haptic("selection");
    } else if (dampened < threshold && triggered) {
      setTriggered(false);
    }

    if (dist > 10) {
      // Only prevent default when pulling down at the top — keeps normal scroll
      if (el.scrollTop === 0) e.preventDefault();
    }
  }, [refreshing, threshold, triggered]);

  const handleTouchEnd = useCallback(async () => {
    if (triggered && !refreshing) {
      setRefreshing(true);
      haptic("success");
      try { await onRefresh(); } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
    setTriggered(false);
    startY.current = null;
  }, [triggered, refreshing, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove",  handleTouchMove,  { passive: false });
    el.addEventListener("touchend",   handleTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove",  handleTouchMove);
      el.removeEventListener("touchend",   handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const indicatorY = Math.min(pullDistance, threshold * 1.4);
  const progress   = Math.min(pullDistance / threshold, 1);

  return (
    <div ref={containerRef} className="ptr-container">
      {/* Pull indicator */}
      <div
        className="ptr-indicator"
        aria-hidden
        style={{
          transform:  `translateY(${indicatorY}px)`,
          opacity:    Math.min(progress * 1.5, 1),
        }}
      >
        <div
          className={`ptr-spinner ${refreshing ? "ptr-spinner--spinning" : ""}`}
          style={{ transform: `rotate(${progress * 360}deg)` }}
        >
          {refreshing ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={triggered ? "#1d4ed8" : "#94a3b8"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
            </svg>
          )}
        </div>
        <span className="ptr-label" style={{ color: triggered ? "#1d4ed8" : "#94a3b8" }}>
          {refreshing ? "Refreshing…" : triggered ? "Release to refresh" : "Pull to refresh"}
        </span>
      </div>

      <div style={{ transform: `translateY(${pullDistance > 4 ? indicatorY * 0.3 : 0}px)`, transition: pullDistance === 0 ? "transform 0.3s ease" : "none" }}>
        {children}
      </div>
    </div>
  );
}
