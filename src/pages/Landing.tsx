import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Wand2, ShoppingBag, Palette, ArrowRight, Star, Sparkles, Download, Check, Crown } from 'lucide-react';
import { TIER_CONFIG, formatAmountKo } from '@/lib/tierConfig';
import showmelookLogo from '@/assets/showmelook-logo.webp';

// Use public path for Korean logo to enable preloading and improve LCP
const showmelookKoreanLogo = '/showmelook-korean-logo.png';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import StyleCarousel from '@/components/StyleCarousel';
import MainNavigation from '@/components/MainNavigation';

// Scroll animated section wrapper
const ScrollSection = ({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.1 });
  
  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className={`transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </section>
  );
};

// Particle component for hero background
const Particle = ({ delay, left, size, duration }: { delay: number; left: number; size: number; duration: number }) => (
  <div 
    className="absolute bottom-0 animate-particle-rise opacity-0 pointer-events-none"
    style={{ 
      left: `${left}%`, 
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`
    }}
  >
    <div 
      className="rounded-full bg-gradient-to-br from-coral via-magenta to-purple"
      style={{ width: size, height: size }}
    />
  </div>
);

// Brand colors for random selection
const SPARKLE_COLORS = ['text-coral', 'text-magenta', 'text-purple', 'text-sky', 'text-primary'];
// Reduced max size (was w-10, now max w-5)
const SPARKLE_SIZES = ['w-3 h-3', 'w-3.5 h-3.5', 'w-4 h-4', 'w-4 h-4', 'w-5 h-5'];


// Sparkle star component with random timing, size, and color
const SparklesStar = ({ className, delay }: { className: string; delay: number }) => {
  const [config] = useState(() => ({
    color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
    size: SPARKLE_SIZES[Math.floor(Math.random() * SPARKLE_SIZES.length)],
    delay: Math.random() * 6, // 0~6초 사이 랜덤 딜레이
    duration: 1.0 + Math.random() * 2.0 // 1.0~3.0초 사이 랜덤 지속시간
  }));
  
  return (
    <div className={`absolute ${className} pointer-events-none`}>
      <Sparkles 
        className={`${config.color} ${config.size} animate-twinkle`}
        style={{ 
          '--twinkle-delay': `${config.delay}s`,
          '--twinkle-duration': `${config.duration}s`
        } as React.CSSProperties} 
      />
    </div>
  );
};

// Inline sparkle for decorative elements (always animated with random timing)
const InlineSparkle = ({ className, size = 'w-4 h-4', delay = 0 }: { className?: string; size?: string; delay?: number }) => {
  const [config] = useState(() => ({
    color: className || SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
    delay: Math.random() * 5, // 0~5초 사이 랜덤 딜레이
    duration: 0.8 + Math.random() * 1.5 // 0.8~2.3초 사이 랜덤 지속시간
  }));
  
  return (
    <Sparkles 
      className={`${config.color} ${size} animate-twinkle`}
      style={{ 
        '--twinkle-delay': `${config.delay}s`,
        '--twinkle-duration': `${config.duration}s`
      } as React.CSSProperties} 
    />
  );
};

// Floating orb component
const FloatingOrb = ({ className, gradient, delay }: { className: string; gradient: string; delay: number }) => (
  <div 
    className={`absolute rounded-full blur-2xl animate-float pointer-events-none ${className} ${gradient}`}
    style={{ animationDelay: `${delay}s` }}
  />
);

// Hover particle card component
const HoverParticleCard = ({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [hoverParticles, setHoverParticles] = useState<{ id: number; x: number; y: number; size: number; color: string }[]>([]);
  const particleId = useRef(0);
  const colors = ['bg-coral', 'bg-magenta', 'bg-purple', 'bg-sky'];

  const handleMouseEnter = () => {
    setIsHovered(true);
    // Generate burst of particles on hover
    const newParticles = [];
    for (let i = 0; i < 8; i++) {
      newParticles.push({
        id: particleId.current++,
        x: 50 + (Math.random() - 0.5) * 80,
        y: 50 + (Math.random() - 0.5) * 80,
        size: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    setHoverParticles(newParticles);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setHoverParticles([]);
  };

  return (
    <div 
      className={`relative ${className}`}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isHovered && hoverParticles.map(p => (
        <div
          key={p.id}
          className={`absolute rounded-full ${p.color} animate-sparkle pointer-events-none z-20`}
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
};

// Interactive mouse particle
interface MouseParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
}

const InteractiveParticle = ({ particle, onComplete }: { particle: MouseParticle; onComplete: (id: number) => void }) => {
  return (
    <div
      className="absolute pointer-events-none animate-sparkle"
      style={{
        left: particle.x,
        top: particle.y,
        transform: 'translate(-50%, -50%)',
      }}
      onAnimationEnd={() => onComplete(particle.id)}
    >
      <div
        className={`rounded-full ${particle.color}`}
        style={{ width: particle.size, height: particle.size }}
      />
    </div>
  );
};

// Hook for interactive mouse particles with heavy throttling to prevent forced reflow
const useMouseParticles = () => {
  const [particles, setParticles] = useState<MouseParticle[]>([]);
  const idCounter = useRef(0);
  const lastCallTime = useRef(0);
  const pendingFrame = useRef<number | null>(null);
  const colors = ['bg-coral', 'bg-magenta', 'bg-purple', 'bg-sky', 'bg-primary'];

  const addParticle = useCallback((e: React.MouseEvent<HTMLElement>) => {
    // Heavy throttle to 200ms to minimize reflow impact
    const now = performance.now();
    if (now - lastCallTime.current < 200) return;
    lastCallTime.current = now;

    // Cancel any pending animation frame to avoid stacking
    if (pendingFrame.current) {
      cancelAnimationFrame(pendingFrame.current);
    }

    // Use offsetX/Y directly to avoid getBoundingClientRect() forced reflow
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    
    // Defer state update to next frame to avoid reflow during event
    pendingFrame.current = requestAnimationFrame(() => {
      pendingFrame.current = null;
      const newParticle: MouseParticle = {
        id: idCounter.current++,
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 40,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
      
      setParticles(prev => [...prev, newParticle]);
    });
  }, []);

  const removeParticle = useCallback((id: number) => {
    setParticles(prev => prev.filter(p => p.id !== id));
  }, []);

  return { particles, addParticle, removeParticle };
};

// CTA Section with interactive particles (desktop only for performance)
const CTASection = ({ handleGetStarted }: { handleGetStarted: () => void }) => {
  const { particles, addParticle, removeParticle } = useMouseParticles();
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    // Check for mobile once on mount to disable heavy mouse effects
    setIsMobile(window.matchMedia('(max-width: 768px)').matches);
  }, []);
  
  return (
    <section 
      className="py-24 px-6 bg-gradient-dark relative overflow-hidden cursor-pointer"
      onMouseMove={isMobile ? undefined : addParticle}
    >
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-brand opacity-20" />
      
      {/* Floating Orbs */}
      <FloatingOrb className="top-0 right-0 w-[500px] h-[500px] opacity-35" gradient="bg-gradient-coral" delay={0} />
      <FloatingOrb className="bottom-0 left-0 w-[500px] h-[500px] opacity-35" gradient="bg-gradient-sky" delay={1.5} />
      <FloatingOrb className="top-1/2 left-1/4 w-80 h-80 opacity-30" gradient="bg-gradient-brand" delay={0.5} />
      <FloatingOrb className="bottom-1/4 right-1/4 w-64 h-64 opacity-25" gradient="bg-gradient-to-br from-magenta to-purple" delay={2} />
      
      {/* Sparkle Stars */}
      <SparklesStar className="top-12 left-[10%]" delay={0} />
      <SparklesStar className="top-20 right-[15%]" delay={0.2} />
      <SparklesStar className="bottom-16 left-[20%]" delay={0.4} />
      <SparklesStar className="bottom-24 right-[25%]" delay={0.6} />
      <SparklesStar className="top-1/3 left-[5%]" delay={0.1} />
      <SparklesStar className="top-1/2 right-[8%]" delay={0.3} />
      <SparklesStar className="bottom-1/3 left-[30%]" delay={0.5} />
      <SparklesStar className="top-24 left-1/2" delay={0.7} />
      
      {/* Rising Particles */}
      {[...Array(25)].map((_, i) => (
        <Particle 
          key={i}
          delay={i * 0.3}
          left={Math.random() * 100}
          size={Math.random() * 8 + 4}
          duration={Math.random() * 2 + 4}
        />
      ))}
      
      {/* Interactive Mouse Particles */}
      {particles.map(particle => (
        <InteractiveParticle 
          key={particle.id} 
          particle={particle} 
          onComplete={removeParticle}
        />
      ))}
      
      <div className="container mx-auto max-w-3xl text-center relative z-10 px-4 sm:px-6">
        {/* Logo with sparkles */}
        <div className="relative inline-block mb-4 sm:mb-6">
          <span className="absolute -top-1 -left-2 sm:-top-2 sm:-left-4"><InlineSparkle size="w-5 h-5" delay={0} /></span>
          <span className="absolute -top-2 right-0"><InlineSparkle size="w-4 h-4" delay={0.2} /></span>
          <img 
            src={showmelookLogo} 
            alt="쇼미룩 로고" 
            width={64}
            height={64}
            className="w-12 h-12 sm:w-16 sm:h-16 mx-auto object-contain animate-float" 
          />
          <span className="absolute -bottom-1 -right-2 sm:-right-3"><InlineSparkle size="w-5 h-5" delay={0.4} /></span>
          <span className="absolute bottom-1 -left-3 sm:bottom-2 sm:-left-5"><InlineSparkle size="w-4 h-4" delay={0.6} /></span>
        </div>
        
        <h2 className="font-korean text-2xl sm:text-3xl md:text-5xl text-white mb-3 sm:mb-6 relative leading-tight">
          <span className="absolute -left-6 sm:-left-8 top-0 hidden sm:block"><InlineSparkle size="w-6 h-6" delay={0.1} /></span>
          지금 바로 시작하세요
          <span className="absolute -right-6 sm:-right-8 bottom-0 hidden sm:block"><InlineSparkle size="w-6 h-6" delay={0.3} /></span>
        </h2>
        <p className="text-base sm:text-lg md:text-xl font-korean text-white/70 mb-6 sm:mb-10 px-2">
          당신만의 스타일을 발견할 준비가 되셨나요?
        </p>
        <Button variant="gold" size="lg" onClick={handleGetStarted} className="group relative overflow-hidden font-korean text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4">
          <span className="relative z-10 flex items-center gap-2">
            무료로 시작하기
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
          </span>
          <span className="absolute top-1 right-2"><InlineSparkle className="text-white/50" size="w-4 h-4" delay={0.5} /></span>
        </Button>
        
        <p className="mt-4 sm:mt-6 text-xs sm:text-sm font-korean text-white/50 flex items-center justify-center gap-1 sm:gap-2 px-4">
          <Star className="w-3 h-3 sm:w-4 sm:h-4 animate-twinkle flex-shrink-0" style={{ animationDuration: '0.5s' }} />
          <span className="hidden sm:inline">마우스를 움직여 파티클 효과를 경험하세요</span>
          <span className="sm:hidden">터치하여 파티클 효과를 경험하세요</span>
          <Star className="w-3 h-3 sm:w-4 sm:h-4 animate-twinkle flex-shrink-0" style={{ animationDuration: '0.4s', animationDelay: '0.2s' }} />
        </p>
      </div>
    </section>
  );
};

const Landing = () => {
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  
  const handleGetStarted = () => {
    if (user) {
      navigate('/style');
    } else {
      navigate('/auth');
    }
  };
  return <div className="min-h-screen bg-background">
      {/* Navigation - using shared component */}
      <MainNavigation />

      {/* Hero Section */}
      <section className="pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6 bg-gradient-hero relative overflow-hidden">
        {/* Background gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        
        {/* Floating Orbs */}
        <FloatingOrb className="top-20 right-10 w-96 h-96 opacity-35" gradient="bg-gradient-brand" delay={0} />
        <FloatingOrb className="bottom-10 left-10 w-[500px] h-[500px] opacity-30" gradient="bg-gradient-sky" delay={1} />
        <FloatingOrb className="top-40 left-1/4 w-72 h-72 opacity-25" gradient="bg-gradient-coral" delay={2} />
        <FloatingOrb className="bottom-40 right-1/4 w-80 h-80 opacity-30" gradient="bg-gradient-to-br from-purple to-sky" delay={1.5} />
        
        {/* Sparkle Stars */}
        <SparklesStar className="top-24 left-[15%]" delay={0} />
        <SparklesStar className="top-32 right-[20%]" delay={0.3} />
        <SparklesStar className="top-48 left-[10%]" delay={0.6} />
        <SparklesStar className="top-56 right-[15%]" delay={0.9} />
        <SparklesStar className="bottom-32 left-[25%]" delay={0.2} />
        <SparklesStar className="bottom-48 right-[30%]" delay={0.5} />
        <SparklesStar className="top-36 left-[35%]" delay={0.8} />
        <SparklesStar className="bottom-24 right-[10%]" delay={0.4} />
        
        {/* Rising Particles */}
        {[...Array(30)].map((_, i) => (
          <Particle 
            key={i}
            delay={i * 0.3}
            left={Math.random() * 100}
            size={Math.random() * 10 + 5}
            duration={Math.random() * 3 + 4}
          />
        ))}
        
        <div className="container mx-auto max-w-6xl relative z-10 px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            {/* Animated Hero Logo with Sparkles */}
            <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-4 sm:mb-8 animate-fade-in relative">
              <span className="absolute -top-1 -left-2 sm:-top-2 sm:-left-4"><InlineSparkle size="w-6 h-6" delay={0} /></span>
              <span className="absolute -top-2 left-6 sm:-top-4 sm:left-8 hidden sm:block"><InlineSparkle size="w-4 h-4" delay={0.15} /></span>
              <span className="absolute top-0 right-2 sm:right-4 hidden sm:block"><InlineSparkle size="w-5 h-5" delay={0.3} /></span>
              <span className="absolute -bottom-1 left-8 sm:-bottom-2 sm:left-12 hidden sm:block"><InlineSparkle size="w-4 h-4" delay={0.45} /></span>
              <img 
                src={showmelookLogo} 
                alt="쇼미룩 로고" 
                width={80}
                height={80}
                loading="eager"
                fetchPriority="high"
                className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 object-contain animate-float drop-shadow-lg" 
              />
              <img 
                src={showmelookKoreanLogo} 
                alt="쇼미룩" 
                width={140}
                height={140}
                loading="eager"
                fetchPriority="high"
                className="h-[80px] sm:h-[110px] md:h-[140px] object-contain -ml-2 sm:-ml-3 md:-ml-4 drop-shadow-lg" 
              />
              <span className="absolute -top-1 right-0"><InlineSparkle size="w-5 h-5" delay={0.6} /></span>
              <span className="absolute bottom-2 -right-3 sm:bottom-4 sm:-right-6 hidden sm:block"><InlineSparkle size="w-6 h-6" delay={0.75} /></span>
            </div>
            
            <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-white/80 backdrop-blur px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mb-4 sm:mb-8 animate-fade-in border border-primary/20 shadow-sm">
              <Star className="w-3 h-3 sm:w-4 sm:h-4 text-primary animate-twinkle flex-shrink-0" style={{ animationDuration: '0.5s' }} />
              <span className="text-xs sm:text-sm font-korean font-medium text-foreground">AI 패션 스타일링 서비스</span>
              <InlineSparkle className="text-primary" size="w-4 h-4" delay={0.2} />
            </div>
            
            <h1 className="font-korean text-2xl sm:text-4xl md:text-5xl lg:text-7xl text-foreground leading-tight mb-3 sm:mb-6 animate-fade-in-up">
              나만의 스타일을<br />
              <span className="text-gradient-brand">AI가 완성합니다</span>
            </h1>
            
            <p className="text-sm sm:text-base md:text-xl font-korean text-muted-foreground mb-6 sm:mb-10 max-w-xl mx-auto animate-fade-in-up px-2 sm:px-4" style={{
            animationDelay: '0.2s'
          }}>
              사진 한 장으로 트렌디한 스타일을 경험하세요.
              <span className="hidden sm:inline"><br /></span>
              <span className="sm:hidden"> </span>
              AI가 당신에게 딱 맞는 패션을 제안합니다.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4 justify-center animate-fade-in-up" style={{
            animationDelay: '0.4s'
          }}>
              <Button variant="hero" size="lg" onClick={handleGetStarted} className="group font-korean w-full sm:w-auto text-sm sm:text-base py-2.5 sm:py-3">
                무료로 시작하기
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="hero-outline" size="lg" onClick={() => navigate('/style')} className="font-korean w-full sm:w-auto text-sm sm:text-base py-2.5 sm:py-3 group">
                <InlineSparkle className="text-primary" size="w-5 h-5" delay={0.1} />
                <span className="ml-1">AI 스타일 추천</span>
              </Button>
            </div>
          </div>

          {/* Preview Cards - Style Carousel */}
          <StyleCarousel />
        </div>
      </section>

      {/* How it Works */}
      <ScrollSection className="py-16 sm:py-24 px-4 sm:px-6 bg-background relative overflow-hidden" delay={0}>
        <div id="how-it-works" className="absolute -top-20" />
        {/* Subtle background effects */}
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-gradient-coral rounded-full blur-3xl opacity-5 animate-float" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-gradient-sky rounded-full blur-3xl opacity-5 animate-float" style={{ animationDelay: '2s' }} />
        
        {/* Decorative sparkles */}
        <SparklesStar className="top-16 left-[8%] w-5 h-5" delay={0} />
        <SparklesStar className="top-24 right-[12%] w-6 h-6" delay={0.5} />
        <SparklesStar className="bottom-20 left-[15%] w-4 h-4" delay={1} />
        <SparklesStar className="bottom-32 right-[10%] w-5 h-5" delay={1.5} />
        
        <div className="container mx-auto max-w-5xl relative z-10">
          <div className="text-center mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-2 mb-3 sm:mb-4">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-coral animate-twinkle" />
              <span className="text-xs sm:text-sm font-medium text-primary uppercase tracking-wider">Simple Process</span>
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-sky animate-twinkle" style={{ animationDelay: '0.5s' }} />
            </div>
            <h2 className="font-korean text-2xl sm:text-4xl md:text-5xl text-foreground mb-3 sm:mb-4">
              쉽고 빠르게 시작하세요
            </h2>
            <p className="text-sm sm:text-lg font-korean text-muted-foreground">
              3단계로 완성되는 나만의 스타일
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
            {[{
            icon: <Wand2 className="w-8 h-8" />,
            step: '01',
            title: '프로필 설정',
            desc: '사진을 업로드하고 키, 몸무게, 선호 스타일을 입력하세요.',
            color: 'from-coral to-magenta'
          }, {
            icon: <Palette className="w-8 h-8" />,
            step: '02',
            title: 'AI 스타일 생성',
            desc: 'AI가 당신에게 맞는 트렌디한 스타일을 생성합니다.',
            color: 'from-magenta to-purple'
          }, {
            icon: <ShoppingBag className="w-8 h-8" />,
            step: '03',
            title: '아이템 구매',
            desc: '마음에 드는 아이템을 선택하고 바로 구매하세요.',
            color: 'from-purple to-sky'
          }].map((item, i) => (
            <HoverParticleCard key={item.step} className="relative text-center group">
              {/* Animated icon box */}
              <div className={`w-20 h-20 mx-auto mb-6 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center text-white shadow-brand group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 relative`}>
                {item.icon}
                {/* Icon sparkles on hover */}
                <Sparkles className="absolute -top-2 -right-2 w-4 h-4 text-white opacity-0 group-hover:opacity-100 animate-sparkle transition-opacity" />
                <Sparkles className="absolute -bottom-1 -left-2 w-3 h-3 text-white opacity-0 group-hover:opacity-100 animate-sparkle transition-opacity" style={{ animationDelay: '0.3s' }} />
              </div>
              
              {/* Step number with animation */}
              <span className="text-6xl font-display text-primary/10 absolute -top-4 left-1/2 -translate-x-1/2 -z-10 group-hover:text-primary/20 group-hover:scale-110 transition-all duration-300">
                {item.step}
              </span>
              
              {/* Connecting line animation (except last item) */}
              {i < 2 && (
                <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/20 to-transparent">
                  <div className="absolute top-0 left-0 w-4 h-4 -translate-y-1/2 rounded-full bg-primary/20 animate-pulse-brand" />
                </div>
              )}
              
              <h3 className="font-korean text-xl text-foreground mb-3 group-hover:text-primary transition-colors">{item.title}</h3>
              <p className="font-korean text-muted-foreground">{item.desc}</p>
            </HoverParticleCard>
          ))}
          </div>
        </div>
      </ScrollSection>

      {/* Pricing Section */}
      <ScrollSection className="py-16 sm:py-24 px-4 sm:px-6 bg-muted/30 relative overflow-hidden" delay={100}>
        <div id="pricing" className="absolute -top-20" />
        
        {/* Background effects */}
        <FloatingOrb className="top-10 right-[10%] w-48 h-48 opacity-10" gradient="bg-gradient-brand" delay={0} />
        <FloatingOrb className="bottom-10 left-[10%] w-64 h-64 opacity-10" gradient="bg-gradient-sky" delay={1.5} />
        
        {/* Sparkle decorations */}
        <SparklesStar className="top-20 left-[12%] w-5 h-5" delay={0} />
        <SparklesStar className="top-32 right-[15%] w-6 h-6" delay={0.5} />
        <SparklesStar className="bottom-24 left-[20%] w-4 h-4" delay={1} />
        
        <div className="container mx-auto max-w-5xl relative z-10">
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 mb-3 sm:mb-4">
              <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 animate-twinkle" />
              <span className="text-xs sm:text-sm font-medium text-primary uppercase tracking-wider">Pricing Plans</span>
              <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 animate-twinkle" style={{ animationDelay: '0.5s' }} />
            </div>
            <h2 className="font-korean text-2xl sm:text-4xl md:text-5xl text-foreground mb-3 sm:mb-4">
              나에게 맞는 플랜 선택
            </h2>
            <p className="text-sm sm:text-lg font-korean text-muted-foreground">
              무료로 시작하고, 필요할 때 업그레이드하세요
            </p>
          </div>

          {/* Tier Cards - 구매 기반 등급 시스템 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {(['free', 'bronze', 'silver', 'gold', 'platinum'] as const).map((tierKey) => {
              const tier = TIER_CONFIG[tierKey];
              const isBronze = tierKey === 'bronze';
              const isPlatinum = tierKey === 'platinum';
              
              return (
                <HoverParticleCard 
                  key={tierKey}
                  className={`relative bg-card rounded-2xl p-4 sm:p-5 border transition-all duration-300 hover:shadow-xl ${
                    isBronze 
                      ? 'border-primary shadow-lg ring-2 ring-primary/20' 
                      : isPlatinum
                        ? 'border-purple-500/50 shadow-lg ring-2 ring-purple-500/20'
                        : 'border-border hover:border-primary/30'
                  }`}
                >
                  {/* First Purchase badge */}
                  {isBronze && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-brand text-white text-xs font-medium px-3 py-1 rounded-full shadow-md whitespace-nowrap">
                        첫 구매 시
                      </span>
                    </div>
                  )}

                  {/* Platinum badge */}
                  {isPlatinum && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium px-3 py-1 rounded-full shadow-md whitespace-nowrap">
                        VIP
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center mb-3">
                    <h3 className="font-korean text-base sm:text-lg font-semibold text-foreground mb-1">
                      {tier.nameKo}
                    </h3>
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      {tier.minAmount === 0 
                        ? '가입 즉시' 
                        : `누적 ${formatAmountKo(tier.minAmount)}+`}
                    </div>
                  </div>
                  
                  {/* Key features - show top 3 (4 for platinum) */}
                  <ul className="space-y-1.5 mb-4">
                    {tier.features.slice(0, isPlatinum ? 4 : 3).map((feature, j) => (
                      <li key={j} className="flex items-start gap-1.5 text-xs sm:text-sm">
                        <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                          tier.highlightFeatures?.some(h => feature.includes(h.replace('일일 ', '').replace('회', '')))
                            ? 'text-accent' 
                            : 'text-primary'
                        }`} />
                        <span className="font-korean text-muted-foreground">
                          {feature}
                        </span>
                      </li>
                    ))}
                    {/* Platinum exclusive: Model profile addition */}
                    {isPlatinum && (
                      <li className="flex items-start gap-1.5 text-xs sm:text-sm">
                        <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent" />
                        <span className="font-korean text-muted-foreground">
                          +100만원당 모델 1명 추가
                        </span>
                      </li>
                    )}
                  </ul>
                  
                  <Button 
                    variant={isBronze || isPlatinum ? 'hero' : 'outline'} 
                    size="sm"
                    className="w-full font-korean rounded-full text-xs sm:text-sm"
                    onClick={() => navigate('/pricing')}
                  >
                    자세히 보기
                  </Button>
                </HoverParticleCard>
              );
            })}
          </div>
          
          {/* CTA to pricing page */}
          <div className="text-center">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/pricing')}
              className="font-korean text-muted-foreground hover:text-primary group"
            >
              모든 기능 비교하기
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </ScrollSection>

      {/* CTA Section */}
      <CTASection handleGetStarted={handleGetStarted} />

      {/* Footer */}
      <ScrollSection className="py-8 sm:py-12 md:py-16 px-4 sm:px-6 bg-background border-t border-border relative overflow-hidden" delay={100}>
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent" />
        <FloatingOrb className="top-0 left-1/4 w-32 sm:w-48 h-32 sm:h-48 opacity-10" gradient="bg-gradient-coral" delay={0} />
        <FloatingOrb className="bottom-0 right-1/4 w-40 sm:w-64 h-40 sm:h-64 opacity-10" gradient="bg-gradient-sky" delay={1} />
        
        {/* Sparkle decorations - hidden on mobile */}
        <SparklesStar className="top-8 left-[10%] w-3 h-3 sm:w-4 sm:h-4 hidden sm:block" delay={0} />
        <SparklesStar className="top-12 right-[15%] w-4 h-4 sm:w-5 sm:h-5 hidden sm:block" delay={0.5} />
        <SparklesStar className="bottom-8 left-[20%] w-3 h-3 sm:w-4 sm:h-4 hidden sm:block" delay={1} />
        <SparklesStar className="bottom-12 right-[10%] w-4 h-4 sm:w-5 sm:h-5 hidden sm:block" delay={1.5} />
        
        {/* Rising particles - fewer on mobile */}
        {[...Array(4)].map((_, i) => (
          <Particle 
            key={i}
            delay={i * 0.8}
            left={10 + Math.random() * 80}
            size={Math.random() * 4 + 2}
            duration={Math.random() * 3 + 5}
          />
        ))}
        
        <div className="container mx-auto relative z-10">
          <div className="flex flex-col items-center">
            {/* Animated logo */}
            <button 
              onClick={() => navigate('/')} 
              className="flex items-center justify-center gap-0 mb-4 sm:mb-6 hover:opacity-80 transition-opacity group relative"
            >
              <Sparkles className="absolute -top-1 -left-2 sm:-top-2 sm:-left-4 w-3 h-3 sm:w-4 sm:h-4 text-coral opacity-0 group-hover:opacity-100 animate-sparkle transition-opacity" />
              <img 
                src={showmelookLogo} 
                alt="쇼미룩 로고" 
                width={40}
                height={40}
                className="w-8 h-8 sm:w-10 sm:h-10 object-contain group-hover:animate-float" 
              />
              <img 
                src={showmelookKoreanLogo} 
                alt="쇼미룩" 
                width={70}
                height={70}
                className="h-[50px] sm:h-[60px] md:h-[70px] object-contain -ml-1.5 sm:-ml-2" 
              />
              <Sparkles className="absolute -bottom-0.5 -right-2 sm:-bottom-1 sm:-right-4 w-3 h-3 sm:w-4 sm:h-4 text-sky opacity-0 group-hover:opacity-100 animate-sparkle transition-opacity" style={{ animationDelay: '0.3s' }} />
            </button>
            
            {/* Social/links area with hover effects */}
            <div className="flex items-center gap-4 sm:gap-6 mb-4 sm:mb-6">
              <button 
                onClick={() => navigate('/install')}
                className="text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors relative group flex items-center gap-1"
              >
                <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="font-korean">앱 설치</span>
                <Sparkles className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 w-2 h-2 sm:w-3 sm:h-3 text-primary opacity-0 group-hover:opacity-100 animate-sparkle transition-opacity" />
              </button>
              {['Instagram', 'Twitter', 'Blog'].map((social, i) => (
                <button 
                  key={social}
                  className="text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors relative group"
                >
                  {social}
                  <Sparkles className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 w-2 h-2 sm:w-3 sm:h-3 text-primary opacity-0 group-hover:opacity-100 animate-sparkle transition-opacity" />
                </button>
              ))}
            </div>

            {/* Legal links */}
            <div className="flex items-center gap-4 sm:gap-6 mb-4 sm:mb-6">
              <button 
                onClick={() => navigate('/privacy')}
                className="text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors font-korean"
              >
                개인정보 처리방침
              </button>
              <span className="text-muted-foreground/50">|</span>
              <button 
                onClick={() => navigate('/terms')}
                className="text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors font-korean"
              >
                서비스 이용약관
              </button>
            </div>
            
            {/* Divider with gradient */}
            <div className="w-24 sm:w-32 h-0.5 bg-gradient-brand rounded-full mb-4 sm:mb-6 opacity-50" />
            
            {/* Copyright with sparkles */}
            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 sm:gap-2">
              <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-twinkle flex-shrink-0" />
              <span>© 2026 ShowMeLook</span>
              <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-twinkle flex-shrink-0" style={{ animationDelay: '0.5s' }} />
            </p>
          </div>
        </div>
      </ScrollSection>
    </div>;
};
export default Landing;