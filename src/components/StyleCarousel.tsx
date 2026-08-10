import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles } from 'lucide-react';

// Style images - All optimized small WebP images from /public for LCP
// Real WebP, ~10-30KB each (previously PNGs mislabeled as .webp at ~1MB)
const minimalistMale = '/carousel/minimalist-male-opt.webp';
const minimalistFemale = '/carousel/minimalist-female-opt.webp';
const streetMale = '/carousel/street-male-opt.webp';
const streetFemale = '/carousel/street-female-opt.webp';
const classicMale = '/carousel/classic-male-opt.webp';
const classicFemale = '/carousel/classic-female-opt.webp';
const casualMale = '/carousel/casual-male-opt.webp';
const casualFemale = '/carousel/casual-female-opt.webp';
const sportyMale = '/carousel/sporty-male-opt.webp';
const sportyFemale = '/carousel/sporty-female-opt.webp';

interface StyleData {
  title: string;
  desc: string;
  gradient: string;
  maleImage: string;
  femaleImage: string;
}

const styles: StyleData[] = [
  {
    title: '미니멀리스트',
    desc: '깔끔한 라인의 현대적 스타일',
    gradient: 'from-coral to-magenta',
    maleImage: minimalistMale,
    femaleImage: minimalistFemale,
  },
  {
    title: '스트릿 스타일',
    desc: '도시적인 캐주얼 감성',
    gradient: 'from-magenta to-purple',
    maleImage: streetMale,
    femaleImage: streetFemale,
  },
  {
    title: '클래식 엘레강스',
    desc: '시간을 초월한 우아함',
    gradient: 'from-purple to-sky',
    maleImage: classicMale,
    femaleImage: classicFemale,
  },
  {
    title: '캐주얼 룩',
    desc: '편안한 일상의 스타일',
    gradient: 'from-sky to-coral',
    maleImage: casualMale,
    femaleImage: casualFemale,
  },
  {
    title: '스포티 액티브',
    desc: '역동적인 활동적 스타일',
    gradient: 'from-coral to-purple',
    maleImage: sportyMale,
    femaleImage: sportyFemale,
  },
];

const StyleCarousel = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const scrollPositionRef = useRef(0);
  const isDraggingRef = useRef(false);
  // Cache geometry to avoid forced reflow on every animation frame
  const singleSetWidthRef = useRef(0);
  const offsetLeftRef = useRef(0);

  // Card rotation states - accumulates 180 degrees each flip
  const [cardRotations, setCardRotations] = useState<number[]>(
    Array(styles.length * 3).fill(0)
  );
  // Track which image to show on front (true = male, false = female)
  const [cardGenders] = useState<boolean[]>(
    Array(styles.length * 3).fill(true).map((_, i) => i % 2 === 0)
  );
  // Track if a card is currently animating
  const isAnimatingRef = useRef<boolean[]>(Array(styles.length * 3).fill(false));

  // Duplicate styles for seamless infinite scroll
  const duplicatedStyles = [...styles, ...styles, ...styles];

  // Auto-scroll animation - uses cached geometry to avoid layout thrashing
  const animate = useCallback(() => {
    if (!containerRef.current) {
      animationRef.current = requestAnimationFrame(animate);
      return;
    }

    if (isDraggingRef.current) {
      animationRef.current = requestAnimationFrame(animate);
      return;
    }

    const singleSetWidth = singleSetWidthRef.current;
    if (singleSetWidth > 0) {
      scrollPositionRef.current += 0.5;

      if (scrollPositionRef.current >= singleSetWidth * 2) {
        scrollPositionRef.current = singleSetWidth;
      }
      if (scrollPositionRef.current < singleSetWidth) {
        scrollPositionRef.current = singleSetWidth * 2 - (singleSetWidth - scrollPositionRef.current);
      }

      // Write only - no read after this in the same frame
      containerRef.current.scrollLeft = scrollPositionRef.current;
    }
    animationRef.current = requestAnimationFrame(animate);
  }, []);

  // 초기화는 한 번만 실행
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;

    // Measure once at init, cache the result
    if (containerRef.current) {
      const container = containerRef.current;
      singleSetWidthRef.current = container.scrollWidth / 3;
      offsetLeftRef.current = container.offsetLeft;
      scrollPositionRef.current = singleSetWidthRef.current;
      container.scrollLeft = singleSetWidthRef.current;
      isInitializedRef.current = true;
    }

    // Recompute cached geometry on resize (debounced via rAF)
    let resizeRaf = 0;
    const onResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        singleSetWidthRef.current = containerRef.current.scrollWidth / 3;
        offsetLeftRef.current = containerRef.current.offsetLeft;
      });
    };
    window.addEventListener('resize', onResize, { passive: true });

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      window.removeEventListener('resize', onResize);
    };
  }, [animate]);

  // Helper function to flip a single card - adds 180deg each time
  const flipCard = useCallback((cardIndex: number) => {
    // Skip if this card is currently animating
    if (isAnimatingRef.current[cardIndex]) return;
    
    // Mark as animating
    isAnimatingRef.current[cardIndex] = true;
    
    // Add 180 degrees (accumulates: 0 -> 180 -> 360 -> 540 -> ...)
    setCardRotations(prev => {
      const newState = [...prev];
      newState[cardIndex] = prev[cardIndex] + 180;
      return newState;
    });

    // Mark animation as complete after 3 seconds (flip duration)
    setTimeout(() => {
      isAnimatingRef.current[cardIndex] = false;
    }, 3000);
  }, []);

  // Random flip effect - each card flips continuously with random timing
  useEffect(() => {
    const scheduleNextFlip = (cardIndex: number) => {
      // Random delay between 4-12 seconds before next flip
      const delay = 4000 + Math.random() * 8000;
      
      return setTimeout(() => {
        flipCard(cardIndex);
        // Schedule next flip recursively
        timeoutRefs.current[cardIndex] = scheduleNextFlip(cardIndex);
      }, delay);
    };

    const timeoutRefs = { current: [] as NodeJS.Timeout[] };
    
    // Give each card a random initial delay, then start flipping loop
    duplicatedStyles.forEach((_, cardIndex) => {
      // Random initial delay between 1-8 seconds
      const initialDelay = 1000 + Math.random() * 7000;
      
      timeoutRefs.current[cardIndex] = setTimeout(() => {
        flipCard(cardIndex);
        // Start the continuous flip loop
        timeoutRefs.current[cardIndex] = scheduleNextFlip(cardIndex);
      }, initialDelay);
    });

    return () => {
      timeoutRefs.current.forEach(t => clearTimeout(t));
    };
  }, [duplicatedStyles.length, flipCard]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    isDraggingRef.current = true;
    setStartX(e.pageX - offsetLeftRef.current);
    setScrollLeft(containerRef.current.scrollLeft);
    containerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - offsetLeftRef.current;
    const walk = (x - startX) * 1.5;
    const newScroll = scrollLeft - walk;
    containerRef.current.scrollLeft = newScroll;
    scrollPositionRef.current = newScroll;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    isDraggingRef.current = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
      // 현재 스크롤 위치를 저장하여 그 자리에서 자연스럽게 이어서 스크롤
      scrollPositionRef.current = containerRef.current.scrollLeft;
    }
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    isDraggingRef.current = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
      scrollPositionRef.current = containerRef.current.scrollLeft;
    }
  };

  return (
    <div className="mt-10 sm:mt-16 md:mt-20 max-w-6xl mx-auto overflow-hidden">
      <div
        ref={containerRef}
        className="flex gap-4 sm:gap-6 overflow-x-hidden cursor-grab select-none py-4"
        
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {duplicatedStyles.map((style, i) => {
          const isMale = cardGenders[i];
          const rotation = cardRotations[i];
          const currentImage = isMale ? style.maleImage : style.femaleImage;
          const backImage = isMale ? style.femaleImage : style.maleImage;
          // Middle set (initially visible) should load eagerly - expand to first 3 of middle set for LCP
          const isInitiallyVisible = i >= styles.length && i < styles.length * 2;
          // First 3 visible cards are highest priority (LCP candidates)
          const isLcpCandidate = i >= styles.length && i < styles.length + 3;

          return (
            <div
              key={i}
              className="flex-shrink-0 w-[140px] sm:w-[200px] md:w-[260px] bg-card rounded-xl sm:rounded-2xl p-2 sm:p-4 md:p-6 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-2 border border-border group overflow-hidden relative"
            >
              {/* Image container with 3D flip effect */}
              <div 
                className="aspect-[3/4] rounded-lg sm:rounded-xl mb-2 sm:mb-4 relative overflow-hidden"
                style={{ perspective: '1000px' }}
              >
                <div
                  className="w-full h-full relative"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: `rotateY(${rotation}deg)`,
                    transition: 'transform 5s cubic-bezier(0.25, 0.1, 0.25, 1)',
                  }}
                >
                  {/* Front face */}
                  <div
                    className="absolute inset-0"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <img
                      src={currentImage}
                      alt={`${style.title} 모델`}
                      className="w-full h-full object-cover"
                      width={228}
                      height={285}
                      loading={isInitiallyVisible ? "eager" : "lazy"}
                      fetchPriority={isLcpCandidate ? "high" : isInitiallyVisible ? "low" : "auto"}
                      decoding={isLcpCandidate ? "sync" : "async"}
                      draggable={false}
                    />
                    <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient} opacity-20 group-hover:opacity-10 transition-opacity duration-300`} />
                  </div>

                  {/* Back face - also preload for initially visible cards */}
                  <div
                    className="absolute inset-0"
                    style={{ 
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    <img
                      src={backImage}
                      alt={`${style.title} 모델`}
                      className="w-full h-full object-cover"
                      width={228}
                      height={285}
                      loading={isInitiallyVisible ? "eager" : "lazy"}
                      decoding="async"
                      draggable={false}
                    />
                    <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient} opacity-20`} />
                  </div>
                </div>
              </div>

              {/* Text content */}
              <div>
                <h3 className="font-korean text-xs sm:text-sm md:text-lg text-foreground mb-0.5 sm:mb-1 group-hover:text-primary transition-colors truncate">
                  {style.title}
                </h3>
                <p className="text-[10px] sm:text-xs md:text-sm font-korean text-muted-foreground line-clamp-2 hidden sm:block">
                  {style.desc}
                </p>
              </div>

              {/* Hover sparkles - randomized colors, sizes, and timing */}
              {(() => {
                const sparkleColors = ['text-coral', 'text-magenta', 'text-purple', 'text-sky', 'text-primary', 'text-yellow-400', 'text-pink-400'];
                const sparkleSizes = ['w-2 h-2 sm:w-3 sm:h-3', 'w-3 h-3 sm:w-4 sm:h-4', 'w-3 h-3 sm:w-5 sm:h-5', 'w-4 h-4 sm:w-6 sm:h-6'];
                const color1 = sparkleColors[i % sparkleColors.length];
                const color2 = sparkleColors[(i + 3) % sparkleColors.length];
                const color3 = sparkleColors[(i + 5) % sparkleColors.length];
                const size1 = sparkleSizes[i % sparkleSizes.length];
                const size2 = sparkleSizes[(i + 2) % sparkleSizes.length];
                const size3 = sparkleSizes[(i + 1) % sparkleSizes.length];
                const delay1 = (i * 0.4) % 3;
                const delay2 = ((i * 0.7) + 0.5) % 3;
                const delay3 = ((i * 0.3) + 1.2) % 3;
                const duration1 = 1.5 + (i % 3) * 0.5;
                const duration2 = 1.2 + ((i + 1) % 4) * 0.4;
                const duration3 = 1.8 + ((i + 2) % 3) * 0.3;
                return (
                  <>
                    <Sparkles 
                      className={`absolute top-2 right-2 sm:top-4 sm:right-4 ${size1} ${color1} opacity-0 group-hover:opacity-100 animate-twinkle transition-opacity`}
                      style={{ 
                        '--twinkle-delay': `${delay1}s`,
                        '--twinkle-duration': `${duration1}s`
                      } as React.CSSProperties}
                    />
                    <Sparkles
                      className={`absolute top-3 right-4 sm:top-6 sm:right-8 ${size2} ${color2} opacity-0 group-hover:opacity-100 animate-twinkle transition-opacity`}
                      style={{ 
                        '--twinkle-delay': `${delay2}s`,
                        '--twinkle-duration': `${duration2}s`
                      } as React.CSSProperties}
                    />
                    <Sparkles
                      className={`absolute bottom-10 left-2 sm:bottom-16 sm:left-4 ${size3} ${color3} opacity-0 group-hover:opacity-100 animate-twinkle transition-opacity hidden sm:block`}
                      style={{ 
                        '--twinkle-delay': `${delay3}s`,
                        '--twinkle-duration': `${duration3}s`
                      } as React.CSSProperties}
                    />
                  </>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StyleCarousel;
