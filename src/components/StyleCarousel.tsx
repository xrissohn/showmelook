import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles } from 'lucide-react';

// Style images imports - optimized for display size (228x285)
import minimalistMale from '@/assets/styles/minimalist-male-opt.jpg';
import minimalistFemale from '@/assets/styles/minimalist-female-opt.jpg';
import streetMale from '@/assets/styles/street-male-opt.jpg';
import streetFemale from '@/assets/styles/street-female-opt.jpg';
import classicMale from '@/assets/styles/classic-male-opt.jpg';
import classicFemale from '@/assets/styles/classic-female-opt.jpg';
import casualMale from '@/assets/styles/casual-male-opt.jpg';
import casualFemale from '@/assets/styles/casual-female-opt.jpg';
import sportyMale from '@/assets/styles/sporty-male-opt.jpg';
import sportyFemale from '@/assets/styles/sporty-female-opt.jpg';

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

  // Gender states for flip animation
  const [cardGenders, setCardGenders] = useState<boolean[]>(
    Array(styles.length * 3).fill(true).map((_, i) => i % 2 === 0)
  );
  const [flippingCards, setFlippingCards] = useState<boolean[]>(
    Array(styles.length * 3).fill(false)
  );

  // Duplicate styles for seamless infinite scroll
  const duplicatedStyles = [...styles, ...styles, ...styles];

  // Auto-scroll animation
  const animate = useCallback(() => {
    if (!containerRef.current) {
      animationRef.current = requestAnimationFrame(animate);
      return;
    }

    // isDragging 중에는 스크롤 위치만 동기화하고 자동 스크롤은 하지 않음
    if (isDraggingRef.current) {
      animationRef.current = requestAnimationFrame(animate);
      return;
    }

    scrollPositionRef.current += 0.5; // Speed of scroll
    const container = containerRef.current;
    const singleSetWidth = container.scrollWidth / 3;

    // Reset position for seamless loop
    if (scrollPositionRef.current >= singleSetWidth * 2) {
      scrollPositionRef.current = singleSetWidth;
    }
    if (scrollPositionRef.current < singleSetWidth) {
      scrollPositionRef.current = singleSetWidth * 2 - (singleSetWidth - scrollPositionRef.current);
    }

    container.scrollLeft = scrollPositionRef.current;
    animationRef.current = requestAnimationFrame(animate);
  }, []);

  // 초기화는 한 번만 실행
  const isInitializedRef = useRef(false);
  
  useEffect(() => {
    if (isInitializedRef.current) return;
    
    // Initialize scroll position to middle set
    if (containerRef.current) {
      const singleSetWidth = containerRef.current.scrollWidth / 3;
      scrollPositionRef.current = singleSetWidth;
      containerRef.current.scrollLeft = singleSetWidth;
      isInitializedRef.current = true;
    }

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  // Random gender flip effect
  useEffect(() => {
    const flipInterval = setInterval(() => {
      const cardIndex = Math.floor(Math.random() * duplicatedStyles.length);
      
      setFlippingCards(prev => {
        const newState = [...prev];
        newState[cardIndex] = true;
        return newState;
      });

      setTimeout(() => {
        setCardGenders(prev => {
          const newState = [...prev];
          newState[cardIndex] = !newState[cardIndex];
          return newState;
        });
      }, 400);

      setTimeout(() => {
        setFlippingCards(prev => {
          const newState = [...prev];
          newState[cardIndex] = false;
          return newState;
        });
      }, 800);
    }, 2000);

    return () => clearInterval(flipInterval);
  }, [duplicatedStyles.length]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    isDraggingRef.current = true;
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
    containerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    containerRef.current.scrollLeft = scrollLeft - walk;
    scrollPositionRef.current = containerRef.current.scrollLeft;
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
          const isFlipping = flippingCards[i];
          const currentImage = isMale ? style.maleImage : style.femaleImage;
          // First 5 images (middle set, initially visible) should load eagerly
          const isInitiallyVisible = i >= styles.length && i < styles.length * 2;

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
                  className="w-full h-full relative transition-transform duration-700 ease-in-out"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: isFlipping ? 'rotateY(180deg)' : 'rotateY(0deg)',
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
                      fetchPriority={isInitiallyVisible ? "high" : "auto"}
                      decoding={isInitiallyVisible ? "sync" : "async"}
                      draggable={false}
                    />
                    <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient} opacity-20 group-hover:opacity-10 transition-opacity duration-300`} />
                  </div>

                  {/* Back face */}
                  <div
                    className="absolute inset-0"
                    style={{ 
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    <img
                      src={isMale ? style.femaleImage : style.maleImage}
                      alt={`${style.title} 모델`}
                      className="w-full h-full object-cover"
                      width={228}
                      height={285}
                      loading="lazy"
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

              {/* Hover sparkles */}
              <Sparkles className="absolute top-2 right-2 sm:top-4 sm:right-4 w-3 h-3 sm:w-5 sm:h-5 text-primary opacity-0 group-hover:opacity-100 animate-sparkle transition-opacity" />
              <Sparkles
                className="absolute bottom-10 left-2 sm:bottom-16 sm:left-4 w-2 h-2 sm:w-4 sm:h-4 text-magenta opacity-0 group-hover:opacity-100 animate-sparkle transition-opacity hidden sm:block"
                style={{ animationDelay: '0.3s' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StyleCarousel;
