import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Wand2, ShoppingBag, Palette, ArrowRight, Star } from 'lucide-react';
import showmelookLogo from '@/assets/showmelook-logo.png';
import showmelookKoreanLogo from '@/assets/showmelook-korean-logo.png';
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-gradient-brand rounded-full blur-3xl opacity-20 animate-gradient-flow" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-gradient-sky rounded-full blur-3xl opacity-15 animate-gradient-flow" style={{ animationDelay: '1s' }} />
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Animated Hero Logo */}
            <div className="flex items-center justify-center gap-1 mb-8 animate-fade-in">
              <img 
                src={showmelookLogo} 
                alt="쇼미룩 로고" 
                className="w-20 h-20 object-contain animate-gradient-flow drop-shadow-lg" 
              />
              <img 
                src={showmelookKoreanLogo} 
                alt="쇼미룩" 
                className="h-[140px] object-contain -ml-4 drop-shadow-lg" 
              />
            </div>
            
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-full mb-8 animate-fade-in border border-primary/20 shadow-sm">
              <Star className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">AI 패션 스타일링 서비스</span>
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
          }].map((style, i) => <div key={style.title} className="bg-card rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in-up border border-border group" style={{
            animationDelay: `${0.6 + i * 0.1}s`
          }}>
                <div className={`aspect-[3/4] bg-gradient-to-br ${style.gradient} rounded-xl mb-4 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity`}>
                  <Palette className="w-12 h-12 text-white/70" />
                </div>
                <h3 className="font-display text-lg text-foreground mb-1">{style.title}</h3>
                <p className="text-sm text-muted-foreground">{style.desc}</p>
              </div>)}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 px-6 bg-background">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
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
          }].map((item, i) => <div key={item.step} className="relative text-center group">
                <div className={`w-20 h-20 mx-auto mb-6 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center text-white shadow-brand group-hover:scale-110 transition-transform duration-300`}>
                  {item.icon}
                </div>
                <span className="text-6xl font-display text-primary/10 absolute -top-4 left-1/2 -translate-x-1/2 -z-10">
                  {item.step}
                </span>
                <h3 className="font-display text-xl text-foreground mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>)}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-gradient-dark relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-brand opacity-20" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-coral rounded-full blur-3xl opacity-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-sky rounded-full blur-3xl opacity-20" />
        
        <div className="container mx-auto max-w-3xl text-center relative z-10">
          <img src={showmelookLogo} alt="쇼미룩 로고" className="w-16 h-16 mx-auto mb-6 object-contain" />
          <h2 className="font-display text-4xl md:text-5xl text-white mb-6">
            지금 바로 시작하세요
          </h2>
          <p className="text-xl text-white/70 mb-10">
            당신만의 스타일을 발견할 준비가 되셨나요?
          </p>
          <Button variant="gold" size="xl" onClick={handleGetStarted} className="group">
            무료로 시작하기
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </section>

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