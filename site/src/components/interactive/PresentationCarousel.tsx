import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import styles from './PresentationCarousel.module.css';

export interface Slide {
  src: string;
  alt?: string;
  caption?: string;
}

interface PresentationCarouselProps {
  slides: Slide[];
  title?: string;
  autoPlayInterval?: number;
}

// Resolve image path with base URL (build-time constant)
const resolveImageSrc = (src: string): string => {
  if (src.startsWith('http')) return src;
  const base = (import.meta as any).env?.BASE_URL || '/canvasflow';
  if (src.startsWith('/')) {
    return `${base.replace(/\/$/, '')}${src}`;
  }
  return `${base}${src}`;
};

// Helper to combine CSS module classes
const cx = (...classes: (string | false | undefined | null)[]) => classes.filter(Boolean).join(' ');

export default function PresentationCarousel({
  slides,
  title,
  autoPlayInterval = 5000,
}: PresentationCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadState, setLoadState] = useState<Record<number, 'loading' | 'loaded' | 'error'>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const touchStartX = useRef(0);
  const preloadedUrls = useRef(new Set<string>());

  const totalSlides = slides.length;

  // Resolve all image sources once (stable unless slides prop changes)
  const resolvedSrcs = useMemo(() => slides.map((s) => resolveImageSrc(s.src)), [slides]);

  // Navigation — functional updates avoid dependency on currentIndex,
  // so goNext/goPrev are stable and won't trigger effect re-registration
  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(index, totalSlides - 1)));
    },
    [totalSlides]
  );

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  // Fullscreen API
  const enterFullscreen = useCallback(async () => {
    try {
      await containerRef.current?.requestFullscreen?.();
    } catch {
      // Fullscreen not supported
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) exitFullscreen();
    else enterFullscreen();
  }, [enterFullscreen, exitFullscreen]);

  // Auto-play
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(goNext, autoPlayInterval);
    return () => clearInterval(timer);
  }, [isPlaying, goNext, autoPlayInterval]);

  // Keyboard shortcuts — all handler dependencies are now in the array
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreen && !containerRef.current?.contains(document.activeElement)) {
        return;
      }
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goNext();
          break;
        case ' ':
          e.preventDefault();
          setIsPlaying((p) => !p);
          break;
        case 'Escape':
          if (isFullscreen) {
            e.preventDefault();
            exitFullscreen();
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, goNext, goPrev, toggleFullscreen, exitFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Touch support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? goNext() : goPrev();
    }
  };

  // Handle SSR hydration gap: check if the image is already loaded
  // (onLoad may have fired before React hydrated and attached handlers)
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && loadState[currentIndex] === undefined) {
      if (img.naturalWidth > 0) {
        handleImageLoad(currentIndex);
      } else {
        handleImageError(currentIndex);
      }
    }
  }, [currentIndex]);

  // Preload adjacent images (with caching to avoid repeated requests)
  useEffect(() => {
    const indexes = [
      currentIndex,
      (currentIndex + 1) % totalSlides,
      (currentIndex - 1 + totalSlides) % totalSlides,
    ];
    indexes.forEach((i) => {
      const url = resolvedSrcs[i];
      if (!preloadedUrls.current.has(url)) {
        preloadedUrls.current.add(url);
        const img = new Image();
        img.src = url;
      }
    });
  }, [currentIndex, resolvedSrcs, totalSlides]);

  const handleImageLoad = (index: number) => {
    setLoadState((prev) => ({ ...prev, [index]: 'loaded' }));
  };

  const handleImageError = (index: number) => {
    setLoadState((prev) => ({ ...prev, [index]: 'error' }));
  };

  const currentState = loadState[currentIndex];
  const isLoaded = currentState === 'loaded';
  const isError = currentState === 'error';

  return (
    <div
      ref={containerRef}
      className={cx(styles.carousel, isFullscreen && styles.carouselFullscreen)}
      tabIndex={0}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      {!isFullscreen && (
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {title && <h3 className={styles.headerTitle}>{title}</h3>}
            <span className={styles.headerCounter}>
              {currentIndex + 1} / {totalSlides}
            </span>
          </div>
          <div className={styles.keyboardHints}>
            <span>← → 翻页</span>
            <span>Space 播放/暂停</span>
            <span>F 全屏</span>
          </div>
          <div className={styles.headerControls}>
            <button
              className={styles.controlButton}
              onClick={() => setIsPlaying((p) => !p)}
              aria-label={isPlaying ? '暂停' : '播放'}
              title={isPlaying ? '暂停 (Space)' : '播放 (Space)'}
            >
              {isPlaying ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <div className={styles.progressDots}>
              {slides.map((_, i) => (
                <button
                  key={i}
                  className={cx(styles.dot, i === currentIndex && styles.dotActive)}
                  onClick={() => goTo(i)}
                  aria-label={`跳转到第 ${i + 1} 页`}
                />
              ))}
            </div>
            <button
              className={styles.controlButton}
              onClick={toggleFullscreen}
              aria-label="全屏"
              title="全屏 (F)"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Slide Area */}
      <div className={cx(styles.slideArea, isFullscreen && styles.slideAreaFullscreen)}>
        {/* Loading Spinner */}
        {!isLoaded && !isError && (
          <div className={styles.loading}>
            <svg
              className={styles.spinner}
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className={styles.errorState}>
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span>图片加载失败</span>
          </div>
        )}

        {/* Slide Image */}
        {!isError && (
          <img
            ref={imgRef}
            src={resolvedSrcs[currentIndex]}
            alt={slides[currentIndex].alt || `Slide ${currentIndex + 1}`}
            className={styles.slideImage}
            style={{ opacity: isLoaded ? 1 : 0 }}
            onLoad={() => handleImageLoad(currentIndex)}
            onError={() => handleImageError(currentIndex)}
            draggable={false}
          />
        )}

        {/* Left Arrow */}
        <button
          className={cx(styles.navButton, styles.navButtonLeft)}
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="上一页"
        >
          ‹
        </button>

        {/* Right Arrow */}
        <button
          className={cx(styles.navButton, styles.navButtonRight)}
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="下一页"
        >
          ›
        </button>

        {/* Fullscreen counter overlay */}
        {isFullscreen && (
          <div className={styles.counterOverlay}>
            {currentIndex + 1} / {totalSlides}
          </div>
        )}

        {/* Fullscreen Controls Bar */}
        {isFullscreen && (
          <div className={cx(styles.controlsBar, styles.controlsBarFullscreen)}>
            <button
              className={cx(styles.controlButton, styles.controlButtonFullscreen)}
              onClick={() => setIsPlaying((p) => !p)}
              aria-label={isPlaying ? '暂停' : '播放'}
              title={isPlaying ? '暂停 (Space)' : '播放 (Space)'}
            >
              {isPlaying ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <div className={styles.progressDots}>
              {slides.map((_, i) => (
                <button
                  key={i}
                  className={cx(
                    styles.dot,
                    i === currentIndex ? styles.dotActiveFullscreen : styles.dotFullscreen
                  )}
                  onClick={() => goTo(i)}
                  aria-label={`跳转到第 ${i + 1} 页`}
                />
              ))}
            </div>
            <button
              className={cx(styles.controlButton, styles.controlButtonFullscreen)}
              onClick={toggleFullscreen}
              aria-label="退出全屏"
              title="退出全屏 (Esc)"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Caption */}
      {slides[currentIndex].caption && (
        <div className={cx(styles.caption, isFullscreen && styles.captionFullscreen)}>
          {slides[currentIndex].caption}
        </div>
      )}

      {/* Thumbnail Strip */}
      {!isFullscreen && totalSlides > 1 && (
        <div className={styles.thumbnailStrip}>
          {slides.map((_, i) => (
            <button
              key={i}
              className={cx(styles.thumbnail, i === currentIndex && styles.thumbnailActive)}
              onClick={() => goTo(i)}
              aria-label={`跳转到第 ${i + 1} 页`}
            >
              <img
                src={resolvedSrcs[i]}
                alt={`缩略图 ${i + 1}`}
                className={styles.thumbnailImage}
                loading="lazy"
                draggable={false}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
