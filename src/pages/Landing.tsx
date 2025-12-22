import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Wand2, ShoppingBag, Palette, ArrowRight, Star, Sparkles } from 'lucide-react';
import showmelookLogo from '@/assets/showmelook-logo.png';
import showmelookKoreanLogo from '@/assets/showmelook-korean-logo.png';
import { useState, useCallback, useRef } from 'react';

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

// Sparkle star component
const SparklesStar = ({ className, delay }: { className: string; delay: number }) => (
  <div className={`absolute ${className} pointer-events-none`} style={{ animationDelay: `${delay}s` }}>
    <Sparkles className="text-primary animate-twinkle" style={{ animationDelay: `${delay}s` }} />
  </div>
);

// Floating orb component
const FloatingOrb = ({ className, gradient, delay }: { className: string; gradient: string; delay: number }) => (
  <div 
    className={`absolute rounded-full blur-xl animate-float pointer-events-none ${className} ${gradient}`}
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

// Hook for interactive mouse particles
const useMouseParticles = () => {
  const [particles, setParticles] = useState<MouseParticle[]>([]);
  const idCounter = useRef(0);
  const colors = ['bg-coral', 'bg-magenta', 'bg-purple', 'bg-sky', 'bg-primary'];

  const addParticle = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newParticles: MouseParticle[] = [];
    for (let i = 0; i < 3; i++) {
      newParticles.push({
        id: idCounter.current++,
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 40,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  const removeParticle = useCallback((id: number) => {
    setParticles(prev => prev.filter(p => p.id !== id));
  }, []);

  return { particles, addParticle, removeParticle };
};

// CTA Section with interactive particles
const CTASection = ({ handleGetStarted }: { handleGetStarted: () => void }) => {
  const { particles, addParticle, removeParticle } = useMouseParticles();
  
  return (
    <section 
      className="py-24 px-6 bg-gradient-dark relative overflow-hidden cursor-pointer"
      onMouseMove={addParticle}
    >
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-brand opacity-20" />
      
      {/* Floating Orbs */}
      <FloatingOrb className="top-0 right-0 w-96 h-96 opacity-25" gradient="bg-gradient-coral" delay={0} />
      <FloatingOrb className="bottom-0 left-0 w-96 h-96 opacity-25" gradient="bg-gradient-sky" delay={1.5} />
      <FloatingOrb className="top-1/2 left-1/4 w-64 h-64 opacity-20" gradient="bg-gradient-brand" delay={0.5} />
      <FloatingOrb className="bottom-1/4 right-1/4 w-48 h-48 opacity-15" gradient="bg-gradient-to-br from-magenta to-purple" delay={2} />
      
      {/* Sparkle Stars */}
      <SparklesStar className="top-12 left-[10%] w-6 h-6" delay={0} />
      <SparklesStar className="top-20 right-[15%] w-8 h-8" delay={0.4} />
      <SparklesStar className="bottom-16 left-[20%] w-5 h-5" delay={0.8} />
      <SparklesStar className="bottom-24 right-[25%] w-7 h-7" delay={1.2} />
      <SparklesStar className="top-1/3 left-[5%] w-4 h-4" delay={0.2} />
      <SparklesStar className="top-1/2 right-[8%] w-6 h-6" delay={0.6} />
      <SparklesStar className="bottom-1/3 left-[30%] w-5 h-5" delay={1} />
      <SparklesStar className="top-24 left-1/2 w-4 h-4" delay={1.4} />
      
      {/* Rising Particles */}
      {[...Array(15)].map((_, i) => (
        <Particle 
          key={i}
          delay={i * 0.5}
          left={Math.random() * 100}
          size={Math.random() * 6 + 3}
          duration={Math.random() * 3 + 5}
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
      
      <div className="container mx-auto max-w-3xl text-center relative z-10">
        {/* Logo with sparkles */}
        <div className="relative inline-block mb-6">
          <Sparkles className="absolute -top-2 -left-4 w-5 h-5 text-coral animate-sparkle" style={{ animationDelay: '0s' }} />
          <Sparkles className="absolute -top-3 right-0 w-4 h-4 text-magenta animate-sparkle" style={{ animationDelay: '0.4s' }} />
          <img src={showmelookLogo} alt="쇼미룩 로고" className="w-16 h-16 mx-auto object-contain animate-float" />
          <Sparkles className="absolute -bottom-1 -right-3 w-5 h-5 text-sky animate-sparkle" style={{ animationDelay: '0.8s' }} />
          <Sparkles className="absolute bottom-2 -left-5 w-4 h-4 text-purple animate-sparkle" style={{ animationDelay: '1.2s' }} />
        </div>
        
        <h2 className="font-display text-4xl md:text-5xl text-white mb-6 relative">
          <Sparkles className="absolute -left-8 top-0 w-6 h-6 text-coral/70 animate-twinkle hidden md:block" />
          지금 바로 시작하세요
          <Sparkles className="absolute -right-8 bottom-0 w-6 h-6 text-sky/70 animate-twinkle hidden md:block" style={{ animationDelay: '0.5s' }} />
        </h2>
        <p className="text-xl text-white/70 mb-10">
          당신만의 스타일을 발견할 준비가 되셨나요?
        </p>
        <Button variant="gold" size="xl" onClick={handleGetStarted} className="group relative overflow-hidden">
          <span className="relative z-10 flex items-center gap-2">
            무료로 시작하기
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
          <Sparkles className="absolute top-1 right-2 w-4 h-4 text-white/50 animate-sparkle" />
        </Button>
        
        <p className="mt-6 text-sm text-white/50 flex items-center justify-center gap-2">
          <Star className="w-4 h-4 animate-twinkle" />
          마우스를 움직여 파티클 효과를 경험하세요
          <Star className="w-4 h-4 animate-twinkle" style={{ animationDelay: '0.5s' }} />
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
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-0 hover:opacity-80 transition-opacity">
            <img src={showmelookLogo} alt="쇼미룩 로고" className="w-10 h-10 object-contain" />
            <img src={showmelookKoreanLogo} alt="쇼미룩" className="h-[90px] object-contain -ml-3" />
          </button>
          <div className="flex items-center gap-4">
            {user ? <Button variant="hero" onClick={() => navigate('/style')}>
                내 스타일 만들기
              </Button> : <>
                <Button variant="ghost" onClick={() => navigate('/auth')}>
                  로그인
                </Button>
                <Button variant="hero" onClick={() => navigate('/auth')}>
                  시작하기
                </Button>
              </>}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 bg-gradient-hero relative overflow-hidden">
        {/* Background gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        
        {/* Floating Orbs */}
        <FloatingOrb className="top-20 right-10 w-72 h-72 opacity-25" gradient="bg-gradient-brand" delay={0} />
        <FloatingOrb className="bottom-10 left-10 w-96 h-96 opacity-20" gradient="bg-gradient-sky" delay={1} />
        <FloatingOrb className="top-40 left-1/4 w-48 h-48 opacity-15" gradient="bg-gradient-coral" delay={2} />
        <FloatingOrb className="bottom-40 right-1/4 w-64 h-64 opacity-20" gradient="bg-gradient-to-br from-purple to-sky" delay={1.5} />
        
        {/* Sparkle Stars */}
        <SparklesStar className="top-24 left-[15%] w-6 h-6" delay={0} />
        <SparklesStar className="top-32 right-[20%] w-8 h-8" delay={0.5} />
        <SparklesStar className="top-48 left-[10%] w-5 h-5" delay={1} />
        <SparklesStar className="top-56 right-[15%] w-7 h-7" delay={1.5} />
        <SparklesStar className="bottom-32 left-[25%] w-6 h-6" delay={0.3} />
        <SparklesStar className="bottom-48 right-[30%] w-5 h-5" delay={0.8} />
        <SparklesStar className="top-36 left-[35%] w-4 h-4" delay={1.2} />
        <SparklesStar className="bottom-24 right-[10%] w-6 h-6" delay={0.6} />
        
        {/* Rising Particles */}
        {[...Array(20)].map((_, i) => (
          <Particle 
            key={i}
            delay={i * 0.4}
            left={Math.random() * 100}
            size={Math.random() * 8 + 4}
            duration={Math.random() * 4 + 6}
          />
        ))}
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Animated Hero Logo with Sparkles */}
            <div className="flex items-center justify-center gap-1 mb-8 animate-fade-in relative">
              <Sparkles className="absolute -top-2 -left-4 w-6 h-6 text-coral animate-sparkle" style={{ animationDelay: '0s' }} />
              <Sparkles className="absolute -top-4 left-8 w-4 h-4 text-magenta animate-sparkle" style={{ animationDelay: '0.3s' }} />
              <Sparkles className="absolute top-0 right-4 w-5 h-5 text-purple animate-sparkle" style={{ animationDelay: '0.6s' }} />
              <Sparkles className="absolute -bottom-2 left-12 w-4 h-4 text-sky animate-sparkle" style={{ animationDelay: '0.9s' }} />
              <img 
                src={showmelookLogo} 
                alt="쇼미룩 로고" 
                className="w-20 h-20 object-contain animate-float drop-shadow-lg" 
              />
              <img 
                src={showmelookKoreanLogo} 
                alt="쇼미룩" 
                className="h-[140px] object-contain -ml-4 drop-shadow-lg" 
              />
              <Sparkles className="absolute -top-2 right-0 w-5 h-5 text-coral animate-sparkle" style={{ animationDelay: '1.2s' }} />
              <Sparkles className="absolute bottom-4 -right-6 w-6 h-6 text-magenta animate-sparkle" style={{ animationDelay: '1.5s' }} />
            </div>
            
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-full mb-8 animate-fade-in border border-primary/20 shadow-sm">
              <Star className="w-4 h-4 text-primary animate-twinkle" />
              <span className="text-sm font-medium text-foreground">AI 패션 스타일링 서비스</span>
              <Sparkles className="w-4 h-4 text-primary animate-sparkle" />
            </div>
            
            <h1 className="font-display text-5xl md:text-7xl text-foreground leading-tight mb-6 animate-fade-in-up">
              나만의 스타일을<br />
              <span className="text-gradient-brand">AI가 완성합니다</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-10 max-w-xl mx-auto animate-fade-in-up" style={{
            animationDelay: '0.2s'
          }}>
              사진 한 장으로 트렌디한 스타일을 경험하세요.
              AI가 당신에게 딱 맞는 패션을 제안합니다.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up" style={{
            animationDelay: '0.4s'
          }}>
              <Button variant="hero" size="xl" onClick={handleGetStarted} className="group">
                무료로 시작하기
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="hero-outline" size="xl" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({
              behavior: 'smooth'
            })}>
                자세히 알아보기
              </Button>
            </div>
          </div>

          {/* Preview Cards */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[{
            title: '미니멀리스트',
            desc: '깔끔한 라인의 현대적 스타일',
            gradient: 'from-coral to-magenta'
          }, {
            title: '스트릿 스타일',
            desc: '도시적인 캐주얼 감성',
            gradient: 'from-magenta to-purple'
          }, {
            title: '클래식 엘레강스',
            desc: '시간을 초월한 우아함',
            gradient: 'from-purple to-sky'
          }].map((style, i) => (
            <HoverParticleCard 
              key={style.title} 
              className="bg-card rounded-2xl p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 animate-fade-in-up border border-border group overflow-hidden" 
              style={{ animationDelay: `${0.6 + i * 0.1}s` }}
            >
              <div className={`aspect-[3/4] bg-gradient-to-br ${style.gradient} rounded-xl mb-4 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-all duration-300 group-hover:scale-105`}>
                <Palette className="w-12 h-12 text-white/70 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-display text-lg text-foreground mb-1 group-hover:text-primary transition-colors">{style.title}</h3>
              <p className="text-sm text-muted-foreground">{style.desc}</p>
              {/* Hover sparkles */}
              <Sparkles className="absolute top-4 right-4 w-5 h-5 text-primary opacity-0 group-hover:opacity-100 animate-sparkle transition-opacity" />
              <Sparkles className="absolute bottom-16 left-4 w-4 h-4 text-magenta opacity-0 group-hover:opacity-100 animate-sparkle transition-opacity" style={{ animationDelay: '0.3s' }} />
            </HoverParticleCard>
          ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 px-6 bg-background relative overflow-hidden">
        {/* Subtle background effects */}
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-gradient-coral rounded-full blur-3xl opacity-5 animate-float" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-gradient-sky rounded-full blur-3xl opacity-5 animate-float" style={{ animationDelay: '2s' }} />
        
        {/* Decorative sparkles */}
        <SparklesStar className="top-16 left-[8%] w-5 h-5" delay={0} />
        <SparklesStar className="top-24 right-[12%] w-6 h-6" delay={0.5} />
        <SparklesStar className="bottom-20 left-[15%] w-4 h-4" delay={1} />
        <SparklesStar className="bottom-32 right-[10%] w-5 h-5" delay={1.5} />
        
        <div className="container mx-auto max-w-5xl relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-coral animate-twinkle" />
              <span className="text-sm font-medium text-primary uppercase tracking-wider">Simple Process</span>
              <Sparkles className="w-5 h-5 text-sky animate-twinkle" style={{ animationDelay: '0.5s' }} />
            </div>
            <h2 className="font-display text-4xl md:text-5xl text-foreground mb-4">
              쉽고 빠르게 시작하세요
            </h2>
            <p className="text-lg text-muted-foreground">
              3단계로 완성되는 나만의 스타일
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
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
              
              <h3 className="font-display text-xl text-foreground mb-3 group-hover:text-primary transition-colors">{item.title}</h3>
              <p className="text-muted-foreground">{item.desc}</p>
            </HoverParticleCard>
          ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CTASection handleGetStarted={handleGetStarted} />

      {/* Footer */}
      <footer className="py-12 px-6 bg-background border-t border-border">
        <div className="container mx-auto text-center">
          <button onClick={() => navigate('/')} className="flex items-center justify-center gap-0 mb-4 hover:opacity-80 transition-opacity">
            <img src={showmelookLogo} alt="쇼미룩 로고" className="w-8 h-8 object-contain" />
            <img src={showmelookKoreanLogo} alt="쇼미룩" className="h-[60px] object-contain -ml-2" />
          </button>
          <p className="text-sm text-muted-foreground">© 2025 ShowMeLook. All rights reserved.</p>
        </div>
      </footer>
    </div>;
};
export default Landing;