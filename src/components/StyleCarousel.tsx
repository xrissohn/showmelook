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
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Each card tracks its own gender toggle independently
  const [cardGenders, setCardGenders] = useState<boolean[]>([true, false, true]); // true = male, false = female

  // Rotate styles every 4 seconds
  useEffect(() => {
    const styleInterval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStyleIndex((prev) => (prev + 1) % styles.length);
        setIsTransitioning(false);
      }, 300);
    }, 4000);

    return () => clearInterval(styleInterval);
  }, []);

  // Rotate gender images inside each card every 3 seconds (staggered)
  useEffect(() => {
    const genderInterval = setInterval(() => {
      setCardGenders((prev) => {
        const newGenders = [...prev];
        // Rotate one card at a time for a staggered effect
        const cardToRotate = Math.floor(Math.random() * 3);
        newGenders[cardToRotate] = !newGenders[cardToRotate];
        return newGenders;
      });
    }, 2500);

    return () => clearInterval(genderInterval);
  }, []);

  // Get 3 visible styles (current and next two)
  const getVisibleStyles = () => {
    const visibleStyles: StyleData[] = [];
    for (let i = 0; i < 3; i++) {
      const index = (currentStyleIndex + i) % styles.length;
      visibleStyles.push(styles[index]);
    }
    return visibleStyles;
  };

  const visibleStyles = getVisibleStyles();

  return (
    <div className="mt-10 sm:mt-16 md:mt-20 grid grid-cols-3 gap-2 sm:gap-4 md:gap-6 max-w-4xl mx-auto">
      {visibleStyles.map((style, i) => {
        const isMale = cardGenders[i];
        const currentImage = isMale ? style.maleImage : style.femaleImage;

        return (
          <div
            key={`${currentStyleIndex}-${i}`}
            className={`bg-card rounded-xl sm:rounded-2xl p-2 sm:p-4 md:p-6 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-2 border border-border group overflow-hidden relative ${
              isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
            }`}
            style={{
              animationDelay: `${0.6 + i * 0.1}s`,
            }}
          >
            {/* Image container with gradient overlay */}
            <div className={`aspect-[3/4] rounded-lg sm:rounded-xl mb-2 sm:mb-4 relative overflow-hidden`}>
              {/* Model image with crossfade */}
              <div className="absolute inset-0 transition-opacity duration-700">
                <img
                  src={currentImage}
                  alt={`${style.title} ${isMale ? '남성' : '여성'} 모델`}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient} opacity-30 group-hover:opacity-20 transition-opacity duration-300`} />
              
              {/* Gender indicator */}
              <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium text-foreground transition-all duration-300">
                {isMale ? '👨' : '👩'}
              </div>
            </div>

            {/* Text content */}
            <h3 className="font-korean text-xs sm:text-sm md:text-lg text-foreground mb-0.5 sm:mb-1 group-hover:text-primary transition-colors truncate">
              {style.title}
            </h3>
            <p className="text-[10px] sm:text-xs md:text-sm font-korean text-muted-foreground line-clamp-2 hidden sm:block">
              {style.desc}
            </p>

            {/* Hover sparkles */}
            <Sparkles className="absolute top-2 right-2 sm:top-4 sm:right-4 w-3 h-3 sm:w-5 sm:h-5 text-primary opacity-0 group-hover:opacity-100 animate-sparkle transition-opacity" />
            <Sparkles
              className="absolute bottom-10 left-2 sm:bottom-16 sm:left-4 w-2 h-2 sm:w-4 sm:h-4 text-magenta opacity-0 group-hover:opacity-100 animate-sparkle transition-opacity hidden sm:block"
              style={{ animationDelay: '0.3s' }}
            />
          </div>
        );
      })}

      {/* Carousel indicators */}
      <div className="col-span-3 flex justify-center gap-2 mt-4">
        {styles.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setIsTransitioning(true);
              setTimeout(() => {
                setCurrentStyleIndex(index);
                setIsTransitioning(false);
              }, 300);
            }}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentStyleIndex
                ? 'bg-primary w-6'
                : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
            }`}
            aria-label={`스타일 ${index + 1}로 이동`}
          />
        ))}
      </div>
    </div>
  );
};

export default StyleCarousel;
