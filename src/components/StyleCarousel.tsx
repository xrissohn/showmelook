import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

// Style images imports
import minimalistMale from '@/assets/styles/minimalist-male.jpg';
import minimalistFemale from '@/assets/styles/minimalist-female.jpg';
import streetMale from '@/assets/styles/street-male.jpg';
import streetFemale from '@/assets/styles/street-female.jpg';
import classicMale from '@/assets/styles/classic-male.jpg';
import classicFemale from '@/assets/styles/classic-female.jpg';
import casualMale from '@/assets/styles/casual-male.jpg';
import casualFemale from '@/assets/styles/casual-female.jpg';
import sportyMale from '@/assets/styles/sporty-male.jpg';
import sportyFemale from '@/assets/styles/sporty-female.jpg';

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
  const [currentStyleIndex, setCurrentStyleIndex] = useState(0);
  const [prevStyleIndex, setPrevStyleIndex] = useState(0);
  const [isStyleTransitioning, setIsStyleTransitioning] = useState(false);
  
  // Each card tracks its own gender and rotation state
  const [cardStates, setCardStates] = useState([
    { isMale: true, isFlipping: false },
    { isMale: false, isFlipping: false },
    { isMale: true, isFlipping: false },
  ]);

  // Rotate styles every 5 seconds with smooth crossfade
  useEffect(() => {
    const styleInterval = setInterval(() => {
      setIsStyleTransitioning(true);
      setPrevStyleIndex(currentStyleIndex);
      
      setTimeout(() => {
        setCurrentStyleIndex((prev) => (prev + 1) % styles.length);
      }, 50);
      
      setTimeout(() => {
        setIsStyleTransitioning(false);
      }, 800);
    }, 5000);

    return () => clearInterval(styleInterval);
  }, [currentStyleIndex]);

  // Rotate gender images with 3D flip effect (staggered)
  useEffect(() => {
    const genderInterval = setInterval(() => {
      const cardToRotate = Math.floor(Math.random() * 3);
      
      setCardStates((prev) => {
        const newStates = [...prev];
        newStates[cardToRotate] = { ...newStates[cardToRotate], isFlipping: true };
        return newStates;
      });

      // Toggle gender at midpoint of flip
      setTimeout(() => {
        setCardStates((prev) => {
          const newStates = [...prev];
          newStates[cardToRotate] = { 
            ...newStates[cardToRotate], 
            isMale: !newStates[cardToRotate].isMale 
          };
          return newStates;
        });
      }, 400);

      // End flip animation
      setTimeout(() => {
        setCardStates((prev) => {
          const newStates = [...prev];
          newStates[cardToRotate] = { ...newStates[cardToRotate], isFlipping: false };
          return newStates;
        });
      }, 800);
    }, 3000);

    return () => clearInterval(genderInterval);
  }, []);

  // Get 3 visible styles
  const getVisibleStyles = (index: number) => {
    const visibleStyles: StyleData[] = [];
    for (let i = 0; i < 3; i++) {
      const styleIndex = (index + i) % styles.length;
      visibleStyles.push(styles[styleIndex]);
    }
    return visibleStyles;
  };

  const currentStyles = getVisibleStyles(currentStyleIndex);
  const prevStyles = getVisibleStyles(prevStyleIndex);

  return (
    <div className="mt-10 sm:mt-16 md:mt-20 max-w-4xl mx-auto">
      <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6 relative">
        {currentStyles.map((style, i) => {
          const { isMale, isFlipping } = cardStates[i];
          const currentImage = isMale ? style.maleImage : style.femaleImage;
          const prevStyle = prevStyles[i];
          const prevImage = isMale ? prevStyle.maleImage : prevStyle.femaleImage;

          return (
            <div
              key={i}
              className="bg-card rounded-xl sm:rounded-2xl p-2 sm:p-4 md:p-6 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-2 border border-border group overflow-hidden relative"
            >
              {/* Image container with 3D flip effect */}
              <div 
                className="aspect-[3/4] rounded-lg sm:rounded-xl mb-2 sm:mb-4 relative overflow-hidden"
                style={{ perspective: '1000px' }}
              >
                {/* 3D flip container */}
                <div
                  className="w-full h-full relative transition-transform duration-700 ease-in-out"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: isFlipping ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  {/* Front face */}
                  <div
                    className="absolute inset-0 backface-hidden"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    {/* Crossfade between style transitions */}
                    <div className="relative w-full h-full">
                      {/* Previous image (fading out) */}
                      <img
                        src={prevImage}
                        alt={`${prevStyle.title} 모델`}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                          isStyleTransitioning ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      {/* Current image (fading in) */}
                      <img
                        src={currentImage}
                        alt={`${style.title} 모델`}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                          isStyleTransitioning ? 'opacity-0' : 'opacity-100'
                        }`}
                      />
                    </div>
                    
                    {/* Gradient overlay */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient} opacity-20 group-hover:opacity-10 transition-opacity duration-300`} />
                  </div>

                  {/* Back face (shown during flip) */}
                  <div
                    className="absolute inset-0 backface-hidden"
                    style={{ 
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    <img
                      src={isMale ? style.femaleImage : style.maleImage}
                      alt={`${style.title} 모델`}
                      className="w-full h-full object-cover"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient} opacity-20`} />
                  </div>
                </div>
              </div>

              {/* Text content with smooth transition */}
              <div className={`transition-all duration-500 ${isStyleTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
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

      {/* Carousel indicators */}
      <div className="flex justify-center gap-2 mt-6">
        {styles.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              if (index !== currentStyleIndex) {
                setIsStyleTransitioning(true);
                setPrevStyleIndex(currentStyleIndex);
                setTimeout(() => {
                  setCurrentStyleIndex(index);
                }, 50);
                setTimeout(() => {
                  setIsStyleTransitioning(false);
                }, 800);
              }
            }}
            className={`h-2 rounded-full transition-all duration-500 ${
              index === currentStyleIndex
                ? 'bg-gradient-to-r from-coral to-magenta w-8'
                : 'bg-muted-foreground/30 hover:bg-muted-foreground/50 w-2'
            }`}
            aria-label={`스타일 ${index + 1}로 이동`}
          />
        ))}
      </div>
    </div>
  );
};

export default StyleCarousel;
