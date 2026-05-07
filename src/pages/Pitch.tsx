/**
 * Pitch - 투자 제안서 슬라이드 페이지
 * 키보드 좌우 화살표, 스와이프, 클릭으로 슬라이드 전환
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, 
  ChevronRight, 
  Home, 
  Maximize2, 
  Minimize2,
  Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart, Bar, Line } from 'recharts';
import screenLanding from '@/assets/pitch-screens/landing.png';
import screenStyle from '@/assets/pitch-screens/style-generator.png';
import screenCommunity from '@/assets/pitch-screens/community.png';
import screenAdmin from '@/assets/pitch-screens/admin.png';
import screenPricing from '@/assets/pitch-screens/pricing.png';
import screenMypage from '@/assets/pitch-screens/mypage.png';

// BEP 차트 데이터 (구매 기반 등급제: ARPU ₩315, 변동비 ~₩100/명)
// 인원별 고정비: 1명 215만, 2명 815만, 3명 1,415만
const bepChartData = [
  { users: 0, revenue: 0, cost: 215, profit: -215, staff: 1 },
  { users: 2000, revenue: 63, cost: 235, profit: -172, staff: 1 },
  { users: 5000, revenue: 158, cost: 265, profit: -107, staff: 1 },
  { users: 8000, revenue: 252, cost: 295, profit: -43, staff: 1 },
  { users: 10000, revenue: 315, cost: 315, profit: 0, staff: 1 }, // BEP (1인)
  { users: 15000, revenue: 473, cost: 965, profit: -492, staff: 2 },
  { users: 20000, revenue: 630, cost: 1015, profit: -385, staff: 2 },
  { users: 30000, revenue: 945, cost: 1115, profit: -170, staff: 2 },
  { users: 38000, revenue: 1197, cost: 1195, profit: 2, staff: 2 }, // BEP (2인)
];

// 12개월 현금흐름 데이터 (ARPU ₩315, 변동비 ~₩100/명, 10,000명 돌파 시 1명 채용)
const cashflowChartData = [
  { month: 'M1', users: 100, staff: 1, revenue: 3, fixedCost: 215, variableCost: 1, totalCost: 216, profit: -213, cumulative: -213 },
  { month: 'M2', users: 300, staff: 1, revenue: 9, fixedCost: 215, variableCost: 3, totalCost: 218, profit: -209, cumulative: -422 },
  { month: 'M3', users: 600, staff: 1, revenue: 19, fixedCost: 215, variableCost: 6, totalCost: 221, profit: -202, cumulative: -624 },
  { month: 'M4', users: 1000, staff: 1, revenue: 32, fixedCost: 215, variableCost: 10, totalCost: 225, profit: -193, cumulative: -817 },
  { month: 'M5', users: 1800, staff: 1, revenue: 57, fixedCost: 215, variableCost: 18, totalCost: 233, profit: -176, cumulative: -993 },
  { month: 'M6', users: 3000, staff: 1, revenue: 95, fixedCost: 215, variableCost: 30, totalCost: 245, profit: -150, cumulative: -1143 },
  { month: 'M7', users: 5000, staff: 1, revenue: 158, fixedCost: 215, variableCost: 50, totalCost: 265, profit: -107, cumulative: -1250 },
  { month: 'M8', users: 7500, staff: 1, revenue: 236, fixedCost: 215, variableCost: 75, totalCost: 290, profit: -54, cumulative: -1304 },
  { month: 'M9', users: 10000, staff: 1, revenue: 315, fixedCost: 215, variableCost: 100, totalCost: 315, profit: 0, cumulative: -1304 },
  { month: 'M10', users: 13000, staff: 2, revenue: 410, fixedCost: 815, variableCost: 130, totalCost: 945, profit: -535, cumulative: -1839 },
  { month: 'M11', users: 16000, staff: 2, revenue: 504, fixedCost: 815, variableCost: 160, totalCost: 975, profit: -471, cumulative: -2310 },
  { month: 'M12', users: 20000, staff: 2, revenue: 630, fixedCost: 815, variableCost: 200, totalCost: 1015, profit: -385, cumulative: -2695 },
];

// 룩 4종 선택 시 상품 카드가 동적으로 갱신되는 데모 UI
const LOOK_DATA = [
  { name: '미니멀 데일리', tags: [
    { cat: '상의', brand: 'COS', item: '오버사이즈 셔츠', price: '89,000', stock: '재고 ✓' },
    { cat: '하의', brand: 'UNIQLO', item: '와이드 슬랙스', price: '49,900', stock: '재고 ✓' },
    { cat: '신발', brand: 'New Balance', item: '993 그레이', price: '249,000', stock: '품절 임박' },
  ]},
  { name: '캐주얼 스트릿', tags: [
    { cat: '아우터', brand: 'Carhartt', item: '디트로이트 자켓', price: '298,000', stock: '재고 ✓' },
    { cat: '하의', brand: 'Levi\'s', item: '501 빈티지', price: '139,000', stock: '재고 ✓' },
    { cat: '신발', brand: 'Nike', item: '에어포스 1', price: '139,000', stock: '재고 ✓' },
  ]},
  { name: '오피스 룩', tags: [
    { cat: '상의', brand: 'Theory', item: '실크 블라우스', price: '320,000', stock: '재고 ✓' },
    { cat: '하의', brand: 'MaxMara', item: '테일러드 팬츠', price: '450,000', stock: '재고 ✓' },
    { cat: '가방', brand: 'Coach', item: '타뷰비 토트', price: '690,000', stock: '재고 ✓' },
  ]},
  { name: '데이트 룩', tags: [
    { cat: '원피스', brand: 'Reformation', item: '플로럴 미디 드레스', price: '298,000', stock: '재고 ✓' },
    { cat: '신발', brand: 'Manolo', item: 'BB 펌프스', price: '890,000', stock: '재고 ✓' },
    { cat: '가방', brand: 'Polene', item: 'Numéro Un Nano', price: '520,000', stock: '품절 임박' },
  ]},
];

const InteractiveLookPicker = () => {
  const [selected, setSelected] = useState(0);
  const look = LOOK_DATA[selected];
  return (
    <div className="rounded border border-coral/20 bg-background/60 p-2.5">
      <div className="text-[10px] font-bold tracking-widest text-coral mb-1.5 font-korean">LOOK PICKER · 클릭으로 상품 카드 동적 갱신</div>
      <div className="grid grid-cols-4 gap-1 mb-2">
        {LOOK_DATA.map((l, n) => (
          <button
            key={n}
            onClick={() => setSelected(n)}
            className={cn(
              'aspect-[3/4] rounded border bg-coral/10 flex flex-col items-center justify-center text-[9px] font-korean transition-all hover:bg-coral/20',
              selected === n ? 'border-coral border-2 ring-1 ring-coral/40 bg-coral/20' : 'border-coral/30'
            )}
          >
            <span className="text-[10px] font-bold text-coral">LOOK {n + 1}</span>
            <span className="text-[8px] text-muted-foreground mt-0.5 px-1 text-center leading-tight">{l.name}</span>
            {selected === n && <span className="text-[8px] text-coral/90 mt-0.5">● SELECTED</span>}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        {look.tags.map((t, i) => (
          <div key={i} className="flex items-center gap-1.5 rounded border border-coral/15 bg-coral/[0.03] px-1.5 py-1 text-[9.5px] font-korean">
            <span className="px-1 py-px rounded bg-coral/20 text-coral font-bold text-[8.5px] min-w-[28px] text-center">{t.cat}</span>
            <span className="font-bold text-foreground/90 truncate max-w-[80px]">{t.brand}</span>
            <span className="text-muted-foreground truncate flex-1">{t.item}</span>
            <span className="font-bold text-coral whitespace-nowrap">₩{t.price}</span>
            <span className={cn('text-[8px] whitespace-nowrap', t.stock.includes('품절') ? 'text-amber-500' : 'text-emerald-500')}>{t.stock}</span>
            <button className="ml-0.5 px-1.5 py-0.5 rounded bg-purple text-white text-[8.5px] font-bold whitespace-nowrap">구매 →</button>
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-[9px] text-muted-foreground font-korean text-center">
        선택한 룩 → 상품 태그·가격·재고·딥링크가 즉시 갱신 · 좋아요 / 갤러리 저장 / 공유 / HD 다운로드
      </div>
    </div>
  );
};

const slides = [
  {
    id: 1,
    title: '쇼미룩',
    subtitle: 'AI Virtual Fitting & Style Recommendation Platform',
    content: (
      <div className="text-center space-y-10">
        <div className="space-y-3">
          <div className="inline-block px-4 py-1.5 border border-primary/30 rounded-full text-xs tracking-[0.3em] text-primary uppercase">
            Investment Proposal · 2026
          </div>
          <h1 className="text-6xl md:text-8xl font-bold text-primary font-korean leading-tight tracking-tight">
            쇼미룩
          </h1>
          <p className="text-2xl md:text-3xl font-semibold font-korean">
            나만의 스타일을 <span className="text-primary">AI</span>가 완성합니다
          </p>
          <p className="text-base md:text-lg text-muted-foreground font-korean max-w-2xl mx-auto">
            사진 한 장으로 트렌디한 스타일을 경험하세요.<br />
            AI가 당신에게 딱 맞는 패션을 제안합니다.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <div className="px-5 py-2.5 bg-primary/10 border border-primary/20 rounded-full">
            <span className="text-primary font-semibold text-sm">플랫폼 완성도 80%</span>
          </div>
          <div className="px-5 py-2.5 bg-coral/10 border border-coral/20 rounded-full">
            <span className="text-coral font-semibold text-sm">5,579+ 상품 DNA 분석</span>
          </div>
          <div className="px-5 py-2.5 bg-sky/10 border border-sky/20 rounded-full">
            <span className="text-sky font-semibold text-sm">Gemini · Nano Banana</span>
          </div>
        </div>
        <div className="flex justify-center gap-8 pt-4 text-xs text-muted-foreground tracking-wider">
          <span>showmelook.com</span>
          <span className="opacity-50">|</span>
          <span>contact@showmelook.com</span>
          <span className="opacity-50">|</span>
          <span>v2.0</span>
        </div>
      </div>
    ),
    background: 'bg-gradient-hero'
  },
  {
    id: 2,
    title: 'The Problem',
    subtitle: '온라인 쇼핑의 단절된 경험',
    content: (
      <div className="space-y-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-1 p-6 bg-gradient-to-br from-coral/15 to-coral/5 rounded-2xl border border-coral/20 flex flex-col justify-center">
            <div className="text-5xl md:text-6xl font-bold text-coral mb-2">25~40%</div>
            <div className="text-sm font-semibold font-korean">평균 의류 반품률</div>
            <div className="text-xs text-muted-foreground mt-1">Global Average</div>
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-3">
            {[
              { icon: '📦', title: '높은 반품 비용', desc: '사이즈 불일치와 핏감 확인 불가로 인한 물류·재고 부담' },
              { icon: '😞', title: '스타일 미스매치', desc: '모델 컷과 실제 착용 모습의 괴리 → 고객 실망' },
              { icon: '🎯', title: '개인화 부재', desc: '천편일률적 상품 목록은 체형·취향을 반영하지 못함' },
              { icon: '📉', title: '낮은 전환율', desc: '확신 없는 구매 → 장바구니 이탈, 마케팅 효율 저하' },
            ].map((p, i) => (
              <div key={i} className="p-4 bg-card rounded-xl border border-border">
                <div className="text-2xl mb-2">{p.icon}</div>
                <div className="font-bold text-sm mb-1 font-korean">{p.title}</div>
                <div className="text-xs text-muted-foreground font-korean leading-relaxed">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 bg-muted/40 rounded-xl text-center text-sm text-muted-foreground font-korean">
          기술의 발전에도 불구하고, 패션 이커머스는 여전히 <strong className="text-foreground">"입어볼 수 없다"</strong>는 물리적 한계로 인해 비효율적인 구조를 가지고 있습니다.
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 3,
    title: 'Solution',
    subtitle: '사진 1장으로 완성되는 5단계 원스톱 AI 스타일링',
    content: (
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { n: '01', title: '회원가입', desc: '간편 가입 · 프로필 설정', icon: '👤' },
            { n: '02', title: '사진 업로드', desc: '전신 사진 등록 · 분석', icon: '📸' },
            { n: '03', title: '가상착장 생성', desc: 'AI 실시간 스타일 생성', icon: '✨' },
            { n: '04', title: '상품 선택', desc: '생성된 룩의 상품 확인', icon: '🛍️' },
            { n: '05', title: '쇼핑몰 이동', desc: '파트너몰 구매 연동', icon: '🔗' },
          ].map((s, i) => (
            <div key={i} className="relative p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-colors">
              <div className="text-[10px] tracking-widest text-primary font-bold mb-1">STEP {s.n}</div>
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className="font-bold text-sm font-korean mb-1">{s.title}</div>
              <div className="text-xs text-muted-foreground font-korean">{s.desc}</div>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-4 pt-2">
          {[
            { tag: 'Input', title: 'User Photo', desc: '전신 사진 1장만 업로드', color: 'sky' },
            { tag: 'AI Engine', title: 'Gemini + Nano Banana', desc: '얼굴 합성 + 의류 매칭 + 스타일 추론', color: 'primary' },
            { tag: 'Output', title: 'Look + Buy Link', desc: '생성된 코디 + 구매 딥링크', color: 'coral' },
          ].map((x, i) => (
            <div key={i} className={cn('p-4 rounded-xl border', `bg-${x.color}/5 border-${x.color}/30`)}>
              <div className={cn('text-[10px] tracking-widest font-bold mb-1', `text-${x.color}`)}>{x.tag}</div>
              <div className="font-bold font-korean mb-1">{x.title}</div>
              <div className="text-xs text-muted-foreground font-korean">{x.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 4,
    title: 'Market Opportunity',
    subtitle: '폭발적으로 성장하는 패션 테크 시장',
    content: (
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-6 bg-gradient-to-br from-sky/15 to-sky/5 rounded-2xl border border-sky/20">
            <div className="text-xs text-sky font-semibold tracking-widest mb-2">VIRTUAL FITTING MARKET (2026)</div>
            <div className="text-5xl font-bold text-sky mb-1">$9.81B</div>
            <div className="text-sm text-muted-foreground font-korean">CAGR 20.9% 성장</div>
          </div>
          <div className="p-6 bg-gradient-to-br from-primary/15 to-primary/5 rounded-2xl border border-primary/20">
            <div className="text-xs text-primary font-semibold tracking-widest mb-2">AI FASHION MARKET (2035)</div>
            <div className="text-5xl font-bold text-primary mb-1">$89.4B</div>
            <div className="text-sm text-muted-foreground font-korean">+2,900% 성장 전망</div>
          </div>
        </div>
        <div className="p-5 bg-card rounded-xl border border-border">
          <h4 className="font-bold mb-3 font-korean">🇰🇷 국내 시장 규모 (TAM/SAM/SOM)</h4>
          <div className="space-y-2">
            {[
              { label: 'TAM', value: '58조원', desc: '한국 패션 이커머스 전체', width: '100%', color: 'bg-primary/30' },
              { label: 'SAM', value: '5.8조원', desc: '온라인 스타일링 니즈 시장', width: '60%', color: 'bg-primary/55' },
              { label: 'SOM', value: '280억원', desc: '5년 목표 점유 시장', width: '30%', color: 'bg-primary' },
            ].map((m, i) => (
              <div key={i} className={cn('p-3 rounded-lg text-white flex items-center justify-between', m.color)} style={{ width: m.width }}>
                <span className="font-bold text-sm">{m.label} · {m.value}</span>
                <span className="text-xs opacity-90 font-korean">{m.desc}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {['Gen Z 디지털 네이티브', 'AI 비용 90% ↓', 'AR/메타버스 확산', '지속가능 (반품↓)'].map((t, i) => (
            <div key={i} className="p-2 bg-muted/40 rounded-lg text-center text-xs font-korean">🚀 {t}</div>
          ))}
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 5,
    title: 'Current Traction',
    subtitle: '데이터 기반의 운영 시스템 구축 완료',
    content: (
      <div className="space-y-5">
        <div className="grid md:grid-cols-4 gap-3">
          {[
            { metric: '플랫폼 완성도', value: '80%', desc: '핵심 기능 안정화 단계', accent: 'primary' },
            { metric: '등록 상품 수', value: '5,579', desc: '실시간 카탈로그', accent: 'coral' },
            { metric: 'AI DNA 분석', value: '5,579', desc: '스타일 속성 추출 완료', accent: 'sky' },
            { metric: '추천 엔진', value: 'v8.0', desc: '피드백 학습 적용', accent: 'purple' },
          ].map((s, i) => (
            <div key={i} className={cn('p-4 rounded-xl border', `bg-${s.accent}/5 border-${s.accent}/30`)}>
              <div className="text-xs text-muted-foreground font-korean mb-1">{s.metric}</div>
              <div className={cn('text-3xl font-bold mb-1', `text-${s.accent}`)}>{s.value}</div>
              <div className="text-xs text-muted-foreground font-korean">{s.desc}</div>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-5 bg-card rounded-xl border border-border">
            <h4 className="font-bold mb-3 font-korean">✅ 운영 중인 핵심 기능</h4>
            <div className="grid grid-cols-2 gap-2">
              {['AI 스타일 추천 v8.0', '얼굴 합성 가상 피팅', '5,579+ 상품 카탈로그', '딥링크 어필리에이트', '구매 기반 5등급제', '가족/모델 프로필', '커뮤니티 갤러리', '실시간 어드민 대시보드'].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-korean">
                  <span className="text-primary">●</span>{f}
                </div>
              ))}
            </div>
          </div>
          <div className="p-5 bg-gradient-to-br from-primary/10 to-coral/5 rounded-xl border border-primary/20">
            <h4 className="font-bold mb-3 font-korean">⚙️ 어드민 운영 시스템</h4>
            <ul className="space-y-2 text-sm font-korean">
              <li>• 상품 DNA 자동 분석 · 수동 편집</li>
              <li>• AI 추론 성능 실시간 모니터링</li>
              <li>• Bright Data · Coupang 연동 수집</li>
              <li>• 사용자 피드백 기반 자동 학습</li>
              <li>• 머천트 매핑 · 수수료 정산</li>
            </ul>
            <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
              admin.showmelook.com/dashboard
            </div>
          </div>
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 51,
    title: 'Product Tour · 사용자 화면',
    subtitle: '입력 → AI 생성 → 구매로 이어지는 핵심 사용자 플로우',
    content: (
      <div className="space-y-3">
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <div className="text-[10px] font-bold tracking-widest text-primary mb-1.5 font-korean">ONBOARDING · 가입 → 프로필 설정 → 사진 업로드</div>
          <div className="grid md:grid-cols-4 gap-2 text-[11px] font-korean">
            <div>
              <div className="font-bold text-foreground mb-0.5">STEP 0 · 가입</div>
              <div className="text-muted-foreground leading-snug">Google OAuth 또는 휴대폰 OTP 인증 (10초)</div>
            </div>
            <div>
              <div className="font-bold text-foreground mb-0.5">STEP 1 · 기본 정보</div>
              <div className="text-muted-foreground leading-snug">
                성별 선택 · 키 <span className="text-foreground/80">예) 168cm</span> (100~220) · 몸무게 <span className="text-foreground/80">예) 55kg</span> (30~200) · 체형 1택
                <div className="mt-1 text-[10px] text-coral/90">⚠ 빈칸/범위 초과 시 "키는 100~220cm 사이여야 합니다" 등 인라인 오류</div>
              </div>
            </div>
            <div>
              <div className="font-bold text-foreground mb-0.5">STEP 2 · 내 스타일</div>
              <div className="text-muted-foreground leading-snug">
                선호 스타일 <span className="text-foreground/80">예) 미니멀·캐주얼</span> · 예산 <span className="text-foreground/80">예) 10~30만원</span> · TPO <span className="text-foreground/80">예) 데일리·데이트</span>
                <div className="mt-1 text-[10px] text-coral/90">⚠ 최소 1개 선택 필수, 미선택 시 "스타일을 1개 이상 골라주세요"</div>
              </div>
            </div>
            <div>
              <div className="font-bold text-foreground mb-0.5">STEP 3 · 얼굴 사진</div>
              <div className="text-muted-foreground leading-snug">
                정면 셀카 1장 (어깨 위·밝은 조명·마스크/선글라스 X·JPG·PNG 10MB↓) → 업로드 즉시 미리보기 → 모델 프로필 저장 후 모든 룩에 자동 얼굴 합성
              </div>
            </div>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              img: screenLanding,
              tag: '01 · Landing',
              step: 'STEP 4 · 진입',
              title: '브랜드 진입 + 가입',
              desc: '인터랙티브 LiquidCursor로 첫인상 차별화 → "무료 체험" CTA에서 Google/OTP 가입 10초.',
              features: ['LiquidCursor 인터랙션', 'Google OAuth · OTP 가입', '가입 즉시 5크레딧 지급'],
              color: 'primary',
            },
            {
              img: screenStyle,
              tag: '02 · Style Generator',
              step: 'STEP 5 · 입력 & 생성',
              title: 'AI 스타일 생성기',
              desc: '키·몸무게·내 스타일이 자동 반영된 모델 프로필 + 프롬프트 → 1분 내 풀바디 룩 4종.',
              features: ['키/몸무게/체형 자동 반영', '프롬프트 + HOT 트렌드 선택', '얼굴 합성 풀바디 4종 생성'],
              color: 'coral',
            },
            {
              img: screenCommunity,
              tag: '03 · Community Gallery',
              step: 'STEP 6 · 검증 & 구매',
              title: '커뮤니티 + 원클릭 구매',
              desc: '다른 유저 룩에서 영감 → 좋아요 → 상품 태그 클릭 → 어필리에이트 딥링크로 구매.',
              features: ['인기/최신 정렬', '좋아요·사회적 검증', '상품 태그 → 딥링크 구매'],
              color: 'sky',
            },
          ].map((s, i) => (
            <div key={i} className={cn('rounded-xl border overflow-hidden bg-card flex flex-col', `border-${s.color}/30`)}>
              <div className="aspect-[4/3] bg-muted/30 overflow-hidden border-b border-border relative">
                <img src={s.img} alt={s.title} className="w-full h-full object-cover object-top" loading="lazy" />
                <div className={cn('absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider text-white', `bg-${s.color}`)}>{s.step}</div>
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <div className={cn('text-[10px] tracking-widest font-bold mb-1', `text-${s.color}`)}>{s.tag}</div>
                <div className="font-bold text-sm font-korean mb-1">{s.title}</div>
                <div className="text-xs text-muted-foreground font-korean leading-relaxed mb-2">{s.desc}</div>
                <ul className="mt-auto space-y-0.5">
                  {s.features.map((f, j) => (
                    <li key={j} className="text-[10px] font-korean text-foreground/80 flex items-start gap-1">
                      <span className={cn('mt-1 w-1 h-1 rounded-full flex-shrink-0', `bg-${s.color}`)} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="rounded-lg border border-coral/30 bg-coral/5 px-4 py-3">
            <div className="text-[10px] font-bold tracking-widest text-coral mb-2 font-korean">AI GENERATION RESULT · 생성 결과 한눈에</div>
            <div className="grid md:grid-cols-4 gap-2 text-[11px] font-korean">
              <div className="rounded border border-coral/20 bg-background/60 p-2">
                <div className="font-bold text-coral mb-0.5">룩 4종 동시 생성</div>
                <div className="text-muted-foreground leading-snug">하나의 프롬프트 → 풀바디 3:4 룩 4장. 좌우 스와이프로 비교, 마음에 드는 룩만 갤러리 저장.</div>
              </div>
              <div className="rounded border border-coral/20 bg-background/60 p-2">
                <div className="font-bold text-coral mb-0.5">품질 옵션 · Fast/Pro</div>
                <div className="text-muted-foreground leading-snug">Fast(Gemini Flash, ~30초) / Pro(GPT-5·Nano Banana 2, 얼굴 충실도↑) 토글로 속도·품질 선택.</div>
              </div>
              <div className="rounded border border-coral/20 bg-background/60 p-2">
                <div className="font-bold text-coral mb-0.5">워터마크 정책</div>
                <div className="text-muted-foreground leading-snug">Free 플랜은 ShowMeLook 로고 오버레이 → 자연스러운 브랜드 노출 + 유료 전환 트리거.</div>
              </div>
              <div className="rounded border border-coral/20 bg-background/60 p-2">
                <div className="font-bold text-coral mb-0.5">생성 한도 표시</div>
                <div className="text-muted-foreground leading-snug">남은 일일 한도 + 보너스 크레딧 실시간 노출. 소진 시 업그레이드 모달, Platinum·관리자 무제한.</div>
              </div>
            </div>
            <div className="mt-3 grid md:grid-cols-2 gap-2">
              <div className="rounded border border-coral/20 bg-background/60 p-2.5">
                <div className="text-[10px] font-bold tracking-widest text-coral mb-1.5 font-korean">LOADING TIMELINE · 진행 단계</div>
                <div className="space-y-1 text-[10.5px] font-korean">
                  <div className="flex items-center gap-2"><span className="w-10 text-right text-muted-foreground">0~5s</span><span className="flex-1 h-1.5 rounded-full bg-coral/20"><span className="block h-full w-[15%] rounded-full bg-coral" /></span><span className="text-foreground/80">프로필·DNA 매칭</span></div>
                  <div className="flex items-center gap-2"><span className="w-10 text-right text-muted-foreground">5~25s</span><span className="flex-1 h-1.5 rounded-full bg-coral/20"><span className="block h-full w-[55%] rounded-full bg-coral" /></span><span className="text-foreground/80">상품 추천·룩 4종 병렬 생성</span></div>
                  <div className="flex items-center gap-2"><span className="w-10 text-right text-muted-foreground">25~45s</span><span className="flex-1 h-1.5 rounded-full bg-coral/20"><span className="block h-full w-[85%] rounded-full bg-coral" /></span><span className="text-foreground/80">얼굴 합성·풀바디 렌더</span></div>
                  <div className="flex items-center gap-2"><span className="w-10 text-right text-muted-foreground">~60s</span><span className="flex-1 h-1.5 rounded-full bg-coral/20"><span className="block h-full w-full rounded-full bg-coral" /></span><span className="text-foreground/80">완료 · 토스트 알림</span></div>
                </div>
                <div className="mt-1.5 text-[9.5px] text-muted-foreground font-korean">로딩 중 LoadingProductAds로 추천 상품 미리 노출 → 체감 대기시간 ↓</div>
              </div>
              <InteractiveLookPicker />
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground font-korean text-center">
              상품 태그 · 좋아요 · 공유 · HD 다운로드(유료)까지 결과 카드에서 바로 액션
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-korean">
            <span className="font-bold text-primary">가입·프로필</span>
            <span className="text-muted-foreground">키·몸무게·스타일·얼굴 사진</span>
            <span className="text-muted-foreground/50">→</span>
            <span className="font-bold text-coral">AI 생성</span>
            <span className="text-muted-foreground">풀바디 룩 4종 (1분 이내)</span>
            <span className="text-muted-foreground/50">→</span>
            <span className="font-bold text-sky">공유·검증</span>
            <span className="text-muted-foreground">커뮤니티 갤러리</span>
            <span className="text-muted-foreground/50">→</span>
            <span className="font-bold text-purple">구매</span>
            <span className="text-muted-foreground">어필리에이트 딥링크</span>
          </div>
          <div className="rounded-lg border border-purple/30 bg-purple/5 px-4 py-3">
            <div className="text-[10px] font-bold tracking-widest text-purple mb-2 font-korean">PURCHASE FLOW · 구매 전환 상세</div>
            <div className="grid md:grid-cols-4 gap-2 text-[11px] font-korean">
              <div>
                <div className="font-bold text-foreground mb-0.5">1. 상품 태그 클릭</div>
                <div className="text-muted-foreground leading-snug">룩 이미지 위 인터랙티브 핀 → 가격·브랜드·재고 카드 표시</div>
              </div>
              <div>
                <div className="font-bold text-foreground mb-0.5">2. 딥링크 생성</div>
                <div className="text-muted-foreground leading-snug">LinkPrice·Coupang Partners API로 어필리에이트 URL을 실시간 발급</div>
              </div>
              <div>
                <div className="font-bold text-foreground mb-0.5">3. 머천트 이동</div>
                <div className="text-muted-foreground leading-snug">모바일 인앱 브라우저 우회 + Coupang은 m.coupang.com으로 자동 리다이렉트</div>
              </div>
              <div>
                <div className="font-bold text-foreground mb-0.5">4. 결제 완료 트래킹</div>
                <div className="text-muted-foreground leading-snug">Postback으로 구매 메타데이터 수집 → 등급 자동 승급 + 추천 학습</div>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground font-korean">평균 수수료 2.1~4.2% · 구매 데이터는 다음 추천 품질을 끌어올리는 피드백 루프로 환원</div>
          </div>
        </div>
      </div>
    ),
    background: 'bg-background',
  },
  {
    id: 52,
    title: 'Product Tour · 운영 & 수익화',
    subtitle: '데이터 → 등급 → 락인으로 이어지는 수익 엔진',
    content: (
      <div className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              img: screenAdmin,
              tag: '04 · Admin Dashboard',
              step: 'OPS · 운영',
              title: '실시간 운영 대시보드',
              desc: '5,579+ 상품의 DNA·머천트 매핑·에러를 한 화면에서 관리. 추천 품질 자동 모니터링.',
              features: ['상품 5,579+ DNA 자동 분석', '머천트 매핑·등록 큐', '에러/추론 메트릭 실시간'],
              color: 'primary',
            },
            {
              img: screenPricing,
              tag: '05 · Pricing Tier',
              step: 'MONETIZE · 수익화',
              title: '구매 기반 5등급제',
              desc: '구매 누적 금액으로 자동 승급. 워터마크/생성한도/모델 슬롯을 차등하여 구매를 유도.',
              features: ['Free → Platinum 5단계', '구매액 자동 승급', '한도·기능 차등'],
              color: 'coral',
            },
            {
              img: screenMypage,
              tag: '06 · My Page',
              step: 'RETAIN · 락인',
              title: '내 등급 · 누적 구매',
              desc: '다음 등급까지 진행률을 시각화하고 갤러리·모델·장바구니로 재방문을 유도.',
              features: ['등급 진행률 시각화', '갤러리·모델·장바구니', '추가 구매 동기 부여'],
              color: 'purple',
            },
          ].map((s, i) => (
            <div key={i} className={cn('rounded-xl border overflow-hidden bg-card flex flex-col', `border-${s.color}/30`)}>
              <div className="aspect-[4/3] bg-muted/30 overflow-hidden border-b border-border relative">
                <img src={s.img} alt={s.title} className="w-full h-full object-cover object-top" loading="lazy" />
                <div className={cn('absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider text-white', `bg-${s.color}`)}>{s.step}</div>
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <div className={cn('text-[10px] tracking-widest font-bold mb-1', `text-${s.color}`)}>{s.tag}</div>
                <div className="font-bold text-sm font-korean mb-1">{s.title}</div>
                <div className="text-xs text-muted-foreground font-korean leading-relaxed mb-2">{s.desc}</div>
                <ul className="mt-auto space-y-0.5">
                  {s.features.map((f, j) => (
                    <li key={j} className="text-[10px] font-korean text-foreground/80 flex items-start gap-1">
                      <span className={cn('mt-1 w-1 h-1 rounded-full flex-shrink-0', `bg-${s.color}`)} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-2.5 flex items-center justify-center gap-2 text-xs font-korean">
          <span className="font-bold text-primary">데이터 축적</span>
          <span className="text-muted-foreground">상품 DNA·피드백</span>
          <span className="text-muted-foreground/50">→</span>
          <span className="font-bold text-coral">수익화</span>
          <span className="text-muted-foreground">어필리에이트 + 등급제</span>
          <span className="text-muted-foreground/50">→</span>
          <span className="font-bold text-purple">락인</span>
          <span className="text-muted-foreground">누적 구매·재방문 루프</span>
        </div>
      </div>
    ),
    background: 'bg-background',
  },
  {
    id: 6,
    title: 'Technology',
    subtitle: '검증된 기술력 + 커머스 연동 아키텍처',
    content: (
      <div className="space-y-5">
        <div className="grid md:grid-cols-4 gap-3">
          {[
            { layer: 'Frontend', tech: 'React · Vite · Tailwind', icon: '🎨', color: 'sky' },
            { layer: 'Edge Functions', tech: 'Deno · Supabase Edge', icon: '⚡', color: 'coral' },
            { layer: 'AI Gateway', tech: 'Gemini 2.5/3 · Nano Banana · GPT-5', icon: '🧠', color: 'purple' },
            { layer: 'Backend', tech: 'Supabase Postgres · Auth · Storage', icon: '🗄️', color: 'primary' },
          ].map((item, i) => (
            <div key={i} className={cn('p-4 rounded-xl border', `bg-${item.color}/5 border-${item.color}/30`)}>
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className={cn('text-xs font-bold tracking-widest mb-1', `text-${item.color}`)}>{item.layer.toUpperCase()}</div>
              <div className="text-xs text-muted-foreground font-korean">{item.tech}</div>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="p-4 bg-card rounded-xl border border-border">
            <h4 className="font-bold mb-2 font-korean text-sm">🧠 AI 추천 엔진 v8.0</h4>
            <ul className="text-xs text-muted-foreground space-y-1 font-korean">
              <li>• 상품 DNA 기반 RAG 추천</li>
              <li>• 피드백 자기 학습 (실시간)</li>
              <li>• 크로스 모델 폴백</li>
              <li>• 다단계 캐싱 (L1~L4)</li>
            </ul>
          </div>
          <div className="p-4 bg-card rounded-xl border border-border">
            <h4 className="font-bold mb-2 font-korean text-sm">🔗 커머스 연동</h4>
            <ul className="text-xs text-muted-foreground space-y-1 font-korean">
              <li>• LinkPrice 딥링크 API</li>
              <li>• Coupang Partners API</li>
              <li>• Bright Data 실시간 수집</li>
              <li>• Cafe24 위젯/SDK 임베딩</li>
            </ul>
          </div>
          <div className="p-4 bg-gradient-to-br from-primary/10 to-coral/5 rounded-xl border border-primary/30">
            <h4 className="font-bold mb-2 font-korean text-sm">💰 비용 최적화</h4>
            <ul className="text-xs text-muted-foreground space-y-1 font-korean">
              <li>• 이미지 생성: ~50원/장</li>
              <li>• 캐시 히트율: 70% 목표</li>
              <li>• 실효 비용: <strong className="text-primary">~15원/장</strong></li>
              <li>• DNA 배치 생성 (오프라인)</li>
            </ul>
          </div>
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 7,
    title: 'Pricing Tier',
    subtitle: '구매할수록 등급↑ — Lock-in 효과',
    content: (
      <div className="space-y-5">
        <div className="grid md:grid-cols-5 gap-3">
          {[
            { tier: 'Free', price: '₩0', desc: '5회/일 생성', badge: '무료 체험', color: 'muted-foreground', bg: 'bg-muted/40 border-border' },
            { tier: 'Bronze', price: '첫 구매', desc: '워터마크 제거', badge: 'BEST', color: 'amber-600', bg: 'bg-amber-500/10 border-amber-500/30' },
            { tier: 'Silver', price: '누적 10만원', desc: '10회/일, 추천 우선', badge: '+', color: 'slate-500', bg: 'bg-slate-300/20 border-slate-400/30' },
            { tier: 'Gold', price: '누적 30만원', desc: '30회/일, HD 다운로드', badge: '+', color: 'yellow-600', bg: 'bg-yellow-500/10 border-yellow-500/30' },
            { tier: 'Platinum', price: '누적 100만원', desc: '무제한, 모델 프로필 추가', badge: 'TOP', color: 'purple', bg: 'bg-purple/10 border-purple/30' },
          ].map((t, i) => (
            <div key={i} className={cn('p-4 rounded-xl border relative', t.bg)}>
              {t.badge && t.badge !== '+' && (
                <span className={cn('absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded', `text-${t.color} bg-${t.color}/10`)}>{t.badge}</span>
              )}
              <div className="font-bold text-lg font-korean">{t.tier}</div>
              <div className={cn('text-sm font-semibold mt-1', `text-${t.color}`)}>{t.price}</div>
              <div className="text-xs text-muted-foreground font-korean mt-2">{t.desc}</div>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-5 bg-gradient-to-br from-primary/10 to-coral/5 rounded-xl border border-primary/20">
            <h4 className="font-bold mb-2 font-korean">🔄 Lock-in 메커니즘</h4>
            <p className="text-sm text-muted-foreground font-korean leading-relaxed">
              구독료가 아닌 <strong className="text-foreground">"구매 누적 금액"</strong>으로 등급이 올라가는 구조.<br />
              사용자는 다른 플랫폼이 아닌 <strong className="text-primary">쇼미룩에서 계속 구매할 동기</strong>를 갖게 됩니다.
            </p>
          </div>
          <div className="p-5 bg-card rounded-xl border border-border">
            <h4 className="font-bold mb-2 font-korean">🤝 B2B API Partnership</h4>
            <p className="text-sm text-muted-foreground font-korean leading-relaxed">
              쇼핑몰 연동 시 <strong className="text-foreground">구매 전환당 커미션</strong> 수익 모델 제공.<br />
              자사몰은 별도 비용 없이 가상 피팅 위젯을 도입할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 8,
    title: 'Competitive Advantage',
    subtitle: '단순 피팅을 넘어선 올인원 스타일링 솔루션',
    content: (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-3 text-left font-korean text-sm">주요 기능</th>
                <th className="p-3 text-center text-muted-foreground">Virtusize</th>
                <th className="p-3 text-center text-muted-foreground">Perfect Corp</th>
                <th className="p-3 text-center text-muted-foreground">Wanna</th>
                <th className="p-3 text-center bg-primary/10 text-primary font-bold">ShowMeLook</th>
              </tr>
            </thead>
            <tbody className="font-korean">
              {[
                ['가상 피팅 (Try-on)', '—', '액세서리 위주', '신발 위주', '전신 의류 최적화'],
                ['AI 스타일 추천', '—', '제한적', '—', 'Gemini 멀티모달'],
                ['사이즈 정밀 분석', '실측 입력', '—', 'AR 측정', '사진 기반 추정'],
                ['사용자 편의성', '실측 필요', '앱 설치 필수', '앱 설치 필수', '사진 1장으로 끝'],
                ['도입 비용', 'High', 'Very High', 'High', '합리적 (구매기반)'],
              ].map((row, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="p-3 font-semibold">{row[0]}</td>
                  <td className="p-3 text-center text-muted-foreground">{row[1]}</td>
                  <td className="p-3 text-center text-muted-foreground">{row[2]}</td>
                  <td className="p-3 text-center text-muted-foreground">{row[3]}</td>
                  <td className="p-3 text-center bg-primary/5 text-primary font-semibold">{row[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { icon: '🎯', title: 'All-in-One 플랫폼', desc: '피팅·추천·구매까지 하나의 앱에서' },
            { icon: '✨', title: '초개인화 스타일링', desc: 'AI 스타일리스트가 취향·트렌드 반영' },
            { icon: '💰', title: '비용 효율성 혁신', desc: 'SaaS 구독으로 즉시 도입 가능' },
          ].map((x, i) => (
            <div key={i} className="p-4 bg-gradient-to-br from-primary/10 to-coral/5 rounded-xl border border-primary/20">
              <div className="text-2xl mb-2">{x.icon}</div>
              <div className="font-bold text-sm font-korean mb-1">{x.title}</div>
              <div className="text-xs text-muted-foreground font-korean">{x.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 9,
    title: 'Business Model',
    subtitle: '수익 구조 상세',
    content: (
      <div className="space-y-5">
        {/* 3가지 수익 모델 상세 */}
        <div className="grid md:grid-cols-3 gap-3">
          {/* 구매 기반 등급제 */}
          <div className="p-4 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🏅</span>
              <h4 className="font-bold font-korean">구매 기반 등급제</h4>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 bg-muted/30 rounded">
                <span className="font-korean">Free</span>
                <span className="font-semibold">₩0 (무료 체험)</span>
              </div>
              <div className="flex justify-between p-2 bg-amber-500/10 rounded">
                <span className="font-korean">Bronze</span>
                <span className="font-semibold text-amber-600">첫 구매 시</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-300/20 rounded">
                <span className="font-korean">Silver</span>
                <span className="font-semibold text-slate-500">누적 10만원</span>
              </div>
              <div className="flex justify-between p-2 bg-yellow-500/10 rounded">
                <span className="font-korean">Gold / Platinum</span>
                <span className="font-semibold text-yellow-600">30만 / 100만원</span>
              </div>
              <div className="text-muted-foreground font-korean pt-1 border-t">
                구매할수록 등급↑ → 워터마크 제거, 무제한 생성
              </div>
            </div>
          </div>

          {/* 어필리에이트 */}
          <div className="p-4 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🔗</span>
              <h4 className="font-bold font-korean">어필리에이트 (핵심 수익)</h4>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 bg-muted/30 rounded">
                <span className="font-korean">LinkPrice 평균</span>
                <span className="font-semibold">2.1~4.2%</span>
              </div>
              <div className="flex justify-between p-2 bg-muted/30 rounded">
                <span className="font-korean">Coupang Partners</span>
                <span className="font-semibold">3%</span>
              </div>
              <div className="p-2 bg-primary/10 rounded font-korean">
                <div>구매전환율 15% × 평균주문 7만원</div>
                <div>× 수수료 3%</div>
                <div className="text-primary font-bold mt-1">ARPU = ₩315/사용자/월</div>
              </div>
            </div>
          </div>

          {/* B2B SaaS */}
          <div className="p-4 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🏢</span>
              <h4 className="font-bold font-korean">B2B SaaS (Cafe24)</h4>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 bg-muted/30 rounded">
                <span className="font-korean">기본료</span>
                <span className="font-semibold">₩99,000/월</span>
              </div>
              <div className="flex justify-between p-2 bg-muted/30 rounded">
                <span className="font-korean">API 호출 초과</span>
                <span className="font-semibold">₩10/건</span>
              </div>
              <div className="flex justify-between p-2 bg-muted/30 rounded">
                <span className="font-korean">엔터프라이즈</span>
                <span className="font-semibold">₩499,000/월~</span>
              </div>
              <div className="text-muted-foreground font-korean pt-1 border-t">
                가상피팅 위젯/SDK 임베딩, 상품동기화 API
              </div>
            </div>
          </div>
        </div>

        {/* 5년 매출 전망 테이블 */}
        <div className="p-4 bg-primary/5 rounded-lg">
          <h4 className="font-bold mb-3 font-korean">📈 5년 매출 전망 (단위: 억원)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2 text-left font-korean">구분</th>
                  <th className="p-2 text-center">Y1</th>
                  <th className="p-2 text-center">Y2</th>
                  <th className="p-2 text-center">Y3</th>
                  <th className="p-2 text-center">Y4</th>
                  <th className="p-2 text-center">Y5</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="p-2 font-korean">어필리에이트</td>
                   <td className="p-2 text-center">0.4</td>
                   <td className="p-2 text-center">4</td>
                   <td className="p-2 text-center">18</td>
                   <td className="p-2 text-center">36</td>
                   <td className="p-2 text-center">72</td>
                 </tr>
                 <tr className="border-b border-border/50">
                   <td className="p-2 font-korean">B2B SaaS</td>
                   <td className="p-2 text-center">-</td>
                   <td className="p-2 text-center">2</td>
                   <td className="p-2 text-center">10</td>
                   <td className="p-2 text-center">30</td>
                   <td className="p-2 text-center">60</td>
                 </tr>
                 <tr className="bg-primary/10 font-bold">
                   <td className="p-2 font-korean">합계</td>
                   <td className="p-2 text-center text-primary">0.4</td>
                   <td className="p-2 text-center text-primary">6</td>
                   <td className="p-2 text-center text-primary">28</td>
                   <td className="p-2 text-center text-primary">66</td>
                   <td className="p-2 text-center text-primary">132</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground font-korean">
            <span>• Y1: 1만명</span>
            <span>• Y2: 10만명</span>
            <span>• Y3: 50만명</span>
            <span>• Y4: 100만명</span>
            <span>• Y5: 200만명</span>
            <span className="text-primary/70">전환율 15%</span>
          </div>
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 10,
    title: 'Cost Structure & BEP',
    subtitle: '손익분기점 분석',
    content: (
      <div className="space-y-5">
        {/* 4개 카드 - 고정비용(1인), 인원비례비용, 변동비용, BEP 결과 */}
        <div className="grid md:grid-cols-4 gap-3">
          {/* 고정 비용 (1인 기준) */}
          <div className="p-3 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🏢</span>
              <h4 className="font-bold text-sm font-korean">고정 비용 (1인)</h4>
            </div>
            <div className="text-2xl font-bold text-primary mb-2">₩215만<span className="text-xs font-normal text-muted-foreground">/월</span></div>
            <div className="space-y-1 text-xs font-korean">
              <div className="flex justify-between p-1.5 bg-muted/30 rounded">
                <span>인프라</span>
                <span>₩5만</span>
              </div>
              <div className="flex justify-between p-1.5 bg-muted/30 rounded">
                <span>개발운영비</span>
                <span>₩100만</span>
              </div>
              <div className="flex justify-between p-1.5 bg-muted/30 rounded">
                <span>기장/세무</span>
                <span>₩10만</span>
              </div>
              <div className="flex justify-between p-1.5 bg-muted/30 rounded">
                <span>사무실 임대</span>
                <span>₩50만</span>
              </div>
              <div className="flex justify-between p-1.5 bg-muted/30 rounded">
                <span>사무실 운영</span>
                <span>₩50만</span>
              </div>
            </div>
          </div>

          {/* 인원비례 비용 */}
          <div className="p-3 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">👥</span>
              <h4 className="font-bold text-sm font-korean">인원비례 비용</h4>
            </div>
            <div className="space-y-1 text-xs font-korean">
              <div className="flex justify-between p-1.5 bg-sky/10 rounded">
                <span>개발운영비</span>
                <span className="font-semibold text-sky">+₩100만/인</span>
              </div>
              <div className="flex justify-between p-1.5 bg-sky/10 rounded">
                <span>사무실 임대</span>
                <span className="font-semibold text-sky">+₩50만/인</span>
              </div>
              <div className="flex justify-between p-1.5 bg-sky/10 rounded">
                <span>사무실 운영</span>
                <span className="font-semibold text-sky">+₩50만/인</span>
              </div>
              <div className="flex justify-between p-1.5 bg-coral/10 rounded">
                <span>인건비 (창업자 외)</span>
                <span className="font-semibold text-coral">+₩400만/인</span>
              </div>
              <div className="pt-1 mt-1 border-t text-muted-foreground text-center">
                <div className="text-xs">2명: <strong>₩815만</strong></div>
                <div className="text-xs">3명: <strong>₩1,415만</strong></div>
              </div>
            </div>
          </div>

          {/* 변동 비용 */}
          <div className="p-3 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">👤</span>
              <h4 className="font-bold text-sm font-korean">사용자당 변동 비용</h4>
            </div>
            <div className="text-xs text-muted-foreground mb-2 font-korean">등급별 AI 생성 비용</div>
            <div className="space-y-1 text-xs font-korean">
              <div className="flex justify-between p-1.5 bg-muted/30 rounded">
                <span>Free (70%)</span>
                <span className="font-semibold">₩50</span>
              </div>
              <div className="flex justify-between p-1.5 bg-amber-500/10 rounded">
                <span>Bronze (15%)</span>
                <span className="font-semibold text-amber-600">₩120</span>
              </div>
              <div className="flex justify-between p-1.5 bg-slate-300/20 rounded">
                <span>Silver (10%)</span>
                <span className="font-semibold text-slate-500">₩200</span>
              </div>
              <div className="flex justify-between p-1.5 bg-yellow-500/10 rounded">
                <span>Gold+ (5%)</span>
                <span className="font-semibold text-yellow-600">₩350</span>
              </div>
              <div className="pt-1 border-t text-muted-foreground">
                가중 평균: <strong className="text-primary">~₩100/명</strong>
              </div>
            </div>
          </div>

          {/* BEP 결과 */}
          <div className="p-3 bg-primary/5 rounded-xl border border-primary/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🎯</span>
              <h4 className="font-bold text-sm font-korean">BEP 결과</h4>
            </div>
            <div className="text-center py-2">
              <div className="text-3xl font-bold text-primary">~10,000명</div>
              <div className="text-xs text-muted-foreground font-korean">1인 손익분기점</div>
              <div className="text-sm font-semibold text-coral mt-1">(구매전환 ~1,500명)</div>
            </div>
            <div className="space-y-1.5 text-xs font-korean pt-2 border-t">
              <div className="flex justify-between">
                <span>2인 팀</span>
                <span className="font-bold text-sky">~38,000명</span>
              </div>
              <div className="flex justify-between">
                <span>ARPU</span>
                <span className="font-bold text-primary">₩315/명/월</span>
              </div>
              <div className="flex justify-between">
                <span>변동비</span>
                <span className="font-bold text-primary">~₩100/명</span>
              </div>
            </div>
          </div>
        </div>

        {/* 규모별 손익 차트 */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* 차트 */}
          <div className="p-4 bg-card rounded-lg border border-border">
            <h4 className="font-bold mb-3 font-korean">📈 규모별 손익 추이</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bepChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--sky))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--sky))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--coral))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--coral))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="users" 
                    tick={{ fontSize: 10 }} 
                    tickFormatter={(v) => v >= 1000 ? `${v/1000}K` : v}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }} 
                    tickFormatter={(v) => `${v}만`}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number, name: string) => [
                      `₩${value}만`, 
                      name === 'revenue' ? '매출' : name === 'cost' ? '비용' : '순이익'
                    ]}
                    labelFormatter={(label) => `${label.toLocaleString()}명`}
                  />
                  <ReferenceLine x={10000} stroke="hsl(var(--coral))" strokeDasharray="5 5" label={{ value: 'BEP(1인)', fontSize: 9, fill: 'hsl(var(--coral))' }} />
                  <ReferenceLine x={38000} stroke="hsl(var(--sky))" strokeDasharray="5 5" label={{ value: 'BEP(2인)', fontSize: 9, fill: 'hsl(var(--sky))' }} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--sky))" fill="url(#colorRevenue)" strokeWidth={2} name="revenue" />
                  <Area type="monotone" dataKey="cost" stroke="hsl(var(--coral))" fill="url(#colorCost)" strokeWidth={2} name="cost" />
                  <Area type="monotone" dataKey="profit" stroke="hsl(var(--primary))" fill="url(#colorProfit)" strokeWidth={2} name="profit" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2 text-xs font-korean">
              <span className="flex items-center gap-1"><span className="w-3 h-1 bg-sky rounded" /> 매출</span>
              <span className="flex items-center gap-1"><span className="w-3 h-1 bg-coral rounded" /> 비용</span>
              <span className="flex items-center gap-1"><span className="w-3 h-1 bg-primary rounded" /> 순이익</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-t-2 border-dashed border-coral" /> BEP</span>
            </div>
          </div>

          {/* 테이블 */}
          <div className="p-4 bg-card rounded-lg border border-border">
            <h4 className="font-bold mb-3 font-korean">📊 규모별 월 손익</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-1.5 text-left font-korean">사용자</th>
                    <th className="p-1.5 text-center font-korean">인원</th>
                    <th className="p-1.5 text-center font-korean">매출</th>
                    <th className="p-1.5 text-center font-korean">비용</th>
                    <th className="p-1.5 text-center font-korean">순이익</th>
                    <th className="p-1.5 text-center font-korean">마진</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="p-1.5 font-korean">2,000명</td>
                    <td className="p-1.5 text-center">1명</td>
                    <td className="p-1.5 text-center">₩63만</td>
                    <td className="p-1.5 text-center">₩235만</td>
                    <td className="p-1.5 text-center text-coral font-semibold">-₩172만</td>
                    <td className="p-1.5 text-center text-muted-foreground">-</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-1.5 font-korean">5,000명</td>
                    <td className="p-1.5 text-center">1명</td>
                    <td className="p-1.5 text-center">₩158만</td>
                    <td className="p-1.5 text-center">₩265만</td>
                    <td className="p-1.5 text-center text-coral font-semibold">-₩107만</td>
                    <td className="p-1.5 text-center text-muted-foreground">-</td>
                  </tr>
                  <tr className="border-b border-border/50 bg-coral/5">
                    <td className="p-1.5 font-korean">~10,000명 <span className="text-coral">(BEP)</span></td>
                    <td className="p-1.5 text-center">1명</td>
                    <td className="p-1.5 text-center">₩315만</td>
                    <td className="p-1.5 text-center">₩315만</td>
                    <td className="p-1.5 text-center text-muted-foreground">~₩0</td>
                    <td className="p-1.5 text-center">~0%</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-1.5 font-korean">20,000명</td>
                    <td className="p-1.5 text-center">2명</td>
                    <td className="p-1.5 text-center">₩630만</td>
                    <td className="p-1.5 text-center">₩1,015만</td>
                    <td className="p-1.5 text-center text-coral font-semibold">-₩385만</td>
                    <td className="p-1.5 text-center text-muted-foreground">-</td>
                  </tr>
                  <tr className="border-b border-border/50 bg-sky/5">
                    <td className="p-1.5 font-korean">~38,000명 <span className="text-sky">(BEP 2인)</span></td>
                    <td className="p-1.5 text-center">2명</td>
                    <td className="p-1.5 text-center">₩1,197만</td>
                    <td className="p-1.5 text-center">₩1,195만</td>
                    <td className="p-1.5 text-center text-muted-foreground">~₩0</td>
                    <td className="p-1.5 text-center">~0%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 핵심 가정 */}
        <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground font-korean">
          <span className="px-2 py-1 bg-muted/50 rounded-full">📌 ARPU ₩315/명 (전환율 15%)</span>
          <span className="px-2 py-1 bg-muted/50 rounded-full">📌 변동비 ~₩100/명</span>
          <span className="px-2 py-1 bg-muted/50 rounded-full">📌 인건비 ₩400만/인 (창업자 제외)</span>
          <span className="px-2 py-1 bg-muted/50 rounded-full">📌 캐시 히트율 70%</span>
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 11,
    title: '12-Month Cashflow',
    subtitle: '초기 자본금 & 손익분기 분석',
    content: (
      <div className="space-y-4">
        {/* 4개 카드 */}
        <div className="grid md:grid-cols-4 gap-3">
          {/* 1인 고정비 */}
          <div className="p-3 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">👤</span>
              <h4 className="font-bold text-sm font-korean">1인 고정비</h4>
            </div>
            <div className="text-xl font-bold text-primary">₩215만<span className="text-xs font-normal text-muted-foreground">/월</span></div>
            <div className="text-xs text-muted-foreground font-korean mt-1">M1~M9 (10,000명 미만)</div>
          </div>
          {/* 2인 고정비 */}
          <div className="p-3 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">👥</span>
              <h4 className="font-bold text-sm font-korean">2인 고정비</h4>
            </div>
            <div className="text-xl font-bold text-coral">₩815만<span className="text-xs font-normal text-muted-foreground">/월</span></div>
            <div className="text-xs text-muted-foreground font-korean mt-1">M10~M12 (10,000명 초과)</div>
          </div>
          {/* 변동 비용 */}
          <div className="p-3 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📊</span>
              <h4 className="font-bold text-sm font-korean">사용자당 비용</h4>
            </div>
            <div className="text-xl font-bold text-sky">~₩100<span className="text-xs font-normal text-muted-foreground">/명</span></div>
            <div className="text-xs text-muted-foreground font-korean mt-1">가중 평균 변동비</div>
          </div>
          {/* 초기 자본금 */}
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">💰</span>
              <h4 className="font-bold text-sm font-korean">권장 자본금</h4>
            </div>
            <div className="text-xl font-bold text-primary">₩1,500~2,000만</div>
            <div className="text-xs text-muted-foreground font-korean mt-1">최대손실(₩2,695만) 대비</div>
          </div>
        </div>

        {/* ComposedChart */}
        <div className="p-4 bg-card rounded-lg border border-border">
          <h4 className="font-bold mb-3 font-korean">📈 월별 순이익 & 누적 손익 (10,000명 채용)</h4>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cashflowChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 11 }} 
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  tick={{ fontSize: 10 }} 
                  tickFormatter={(v) => `${v}만`}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      profit: '월 순이익',
                      cumulative: '누적 손익'
                    };
                    return [`₩${value}만`, labels[name] || name];
                  }}
                  labelFormatter={(label) => {
                    const data = cashflowChartData.find(d => d.month === label);
                    return data ? `${label} (${data.users.toLocaleString()}명, ${data.staff}인)` : label;
                  }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <ReferenceLine 
                  x="M10" 
                  stroke="hsl(var(--coral))" 
                  strokeDasharray="5 5" 
                  label={{ value: '채용', fontSize: 10, fill: 'hsl(var(--coral))' }} 
                />
                <Bar 
                  dataKey="profit" 
                  name="profit"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
                <Line 
                  type="monotone" 
                  dataKey="cumulative" 
                  name="cumulative"
                  stroke="hsl(var(--coral))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--coral))', strokeWidth: 0, r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2 text-xs font-korean">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-primary rounded" /> 월 순이익</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-coral rounded" /> 누적 손익</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-t-2 border-dashed border-coral" /> 채용 시점</span>
          </div>
        </div>

        {/* 월별 손익 테이블 */}
        <div className="p-4 bg-card rounded-lg border border-border">
          <h4 className="font-bold mb-3 font-korean">📊 월별 손익 상세</h4>
          <div className="overflow-x-auto max-h-40">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border">
                  <th className="p-1.5 text-left font-korean">월</th>
                  <th className="p-1.5 text-center font-korean">사용자</th>
                  <th className="p-1.5 text-center font-korean">인원</th>
                  <th className="p-1.5 text-center font-korean">매출</th>
                  <th className="p-1.5 text-center font-korean">비용</th>
                  <th className="p-1.5 text-center font-korean">순이익</th>
                  <th className="p-1.5 text-center font-korean">누적</th>
                </tr>
              </thead>
              <tbody>
                {cashflowChartData.map((row) => (
                  <tr 
                    key={row.month} 
                    className={cn(
                      'border-b border-border/50',
                      row.month === 'M9' && 'bg-primary/5',
                      row.month === 'M10' && 'bg-coral/10',
                      row.month === 'M12' && 'bg-primary/10 font-bold'
                    )}
                  >
                    <td className="p-1.5 font-korean">
                      {row.month}
                      {row.month === 'M9' && <span className="text-primary ml-1">(BEP)</span>}
                      {row.month === 'M10' && <span className="text-coral ml-1">(채용)</span>}
                    </td>
                    <td className="p-1.5 text-center">{row.users.toLocaleString()}</td>
                    <td className="p-1.5 text-center">{row.staff}명</td>
                    <td className="p-1.5 text-center">₩{row.revenue}만</td>
                    <td className="p-1.5 text-center">₩{row.totalCost}만</td>
                    <td className={cn('p-1.5 text-center font-semibold', row.profit >= 0 ? 'text-primary' : 'text-coral')}>
                      {row.profit >= 0 ? '+' : ''}₩{row.profit}만
                    </td>
                    <td className={cn('p-1.5 text-center', row.cumulative >= 0 ? 'text-primary' : 'text-coral')}>
                      {row.cumulative >= 0 ? '+' : ''}₩{row.cumulative}만
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 핵심 가정 */}
        <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground font-korean">
          <span className="px-2 py-1 bg-muted/50 rounded-full">📌 ARPU ₩315/명 (전환율 15%)</span>
          <span className="px-2 py-1 bg-muted/50 rounded-full">📌 10,000명 초과 시 1명 채용</span>
          <span className="px-2 py-1 bg-muted/50 rounded-full">📌 12개월 누적 -₩2,695만 (투자 필요)</span>
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 12,
    title: 'GTM Strategy',
    subtitle: '단계별 시장 침투 전략',
    content: (
      <div className="space-y-5">
        <div className="grid md:grid-cols-4 gap-3">
          {[
            { phase: '0-6 Months', title: '베타 테스트 & 초기 사용자', target: 'MAU 1,000+', desc: '패션 얼리어답터 (2030) · 베타 100명 무료 Pro', color: 'sky' },
            { phase: '6-12 Months · Y1', title: '인플루언서 협업 & 바이럴', target: 'MAU 10,000+', desc: '마이크로 인플루언서 · 릴스/쇼츠 · 레퍼럴', color: 'coral' },
            { phase: '12-24 Months · Y2', title: '커머스 플랫폼 제휴', target: 'MAU 10만 · 매출 1억', desc: '무신사·지그재그 등 B2B 영업 · API 세일즈', color: 'purple' },
            { phase: '24+ Months · Y3', title: 'Cafe24 SaaS 확장', target: '100곳 / ARR 10억', desc: '중소형 자사몰 · 앱스토어 플러그인', color: 'primary' },
          ].map((p, i) => (
            <div key={i} className={cn('p-4 rounded-xl border relative', `bg-${p.color}/5 border-${p.color}/30`)}>
              <div className={cn('absolute -top-2 -left-2 w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-xs', `bg-${p.color}`)}>{i+1}</div>
              <div className={cn('text-[10px] font-bold tracking-widest mb-2', `text-${p.color}`)}>{p.phase.toUpperCase()}</div>
              <div className="font-bold text-sm font-korean mb-2">{p.title}</div>
              <div className={cn('inline-block px-2 py-1 rounded text-xs font-semibold mb-2', `bg-${p.color}/10 text-${p.color}`)}>{p.target}</div>
              <div className="text-xs text-muted-foreground font-korean leading-relaxed">{p.desc}</div>
            </div>
          ))}
        </div>
        <div className="p-4 bg-gradient-to-r from-primary/5 via-coral/5 to-sky/5 rounded-xl border border-border">
          <h4 className="font-bold mb-2 font-korean text-sm">🎯 핵심 마일스톤</h4>
          <div className="grid md:grid-cols-3 gap-3 text-xs font-korean">
            <div className="p-2 bg-card rounded"><strong className="text-primary">D11~ MVP 정식 배포</strong> · 무신사 랜딩 연동 테스트</div>
            <div className="p-2 bg-card rounded"><strong className="text-coral">Y1 MAU 1만</strong> · 월 매출 3,000만원</div>
            <div className="p-2 bg-card rounded"><strong className="text-sky">Y2 커머스 파트너 10곳</strong> · ARR 10억</div>
          </div>
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 13,
    title: 'Roadmap',
    subtitle: '현재 80% 완료 — 남은 20%로 시장 진입',
    content: (
      <div className="space-y-5">
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <h4 className="font-bold text-green-700 mb-2 font-korean">✅ 완료된 기능 (Phase 1-4 · 80%)</h4>
          <div className="flex flex-wrap gap-2">
            {['AI 추천 엔진 v8.0', '얼굴 합성 가상 피팅', 'LinkPrice·Coupang 딥링크', '5,579+ 상품 DNA', '피드백 자기 학습', '구매 기반 5등급제', '가족/모델 프로필', '커뮤니티 갤러리', 'Cafe24 위젯 SDK', '실시간 어드민', '에러 모니터링', 'SEO/RSS'].map((item, i) => (
              <span key={i} className="px-3 py-1 bg-green-500/20 text-green-700 rounded-full text-xs font-korean font-semibold">{item}</span>
            ))}
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { q: 'Q1 2026', items: ['Phase 5: 실시간 재고 확인', '상품 2,000+ 확장', 'A/B 테스트 최적화', '결제 연동 (Toss/Stripe)'], color: 'sky' },
            { q: 'Q2 2026', items: ['Cafe24 앱스토어 출시', 'B2B 파트너 10곳 확보', '푸시 알림 (FCM)', '인플루언서 캠페인'], color: 'coral' },
            { q: 'Q3-Q4 2026', items: ['B2B SaaS 정식 출시', '글로벌 (일본/동남아)', 'WebXR 기반 AR 피팅', 'MAU 10만 달성'], color: 'primary' },
          ].map((q, i) => (
            <div key={i} className={cn('p-4 rounded-xl border', `bg-${q.color}/5 border-${q.color}/30`)}>
              <h4 className={cn('font-bold mb-2 font-korean', `text-${q.color}`)}>📅 {q.q}</h4>
              <ul className="text-xs space-y-1 font-korean text-muted-foreground">
                {q.items.map((x, j) => (<li key={j}>• {x}</li>))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 14,
    title: 'Investment Ask',
    subtitle: 'Seed / Pre-A Round',
    content: (
      <div className="space-y-5">
        <div className="text-center">
          <div className="inline-block px-10 py-5 bg-gradient-brand rounded-2xl text-white shadow-2xl">
            <div className="text-xs tracking-widest opacity-90 mb-1">SEED INVESTMENT TARGET</div>
            <div className="text-5xl md:text-6xl font-bold mb-1">1억원</div>
            <div className="text-sm opacity-90 font-korean">린(Lean) 18개월 런웨이 · 1인 운영 + 외주 기반</div>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-5 bg-card rounded-xl border border-border">
            <h4 className="font-bold mb-3 font-korean">💰 자금 사용 계획 (Use of Funds · 1억원)</h4>
            <div className="space-y-2">
              {[
                { use: '마케팅 & 인플루언서', percent: 30, amount: '3,000만', desc: '베타 사용자 확보 · 마이크로 인플루언서 · SNS 광고', color: 'coral' },
                { use: 'AI · R&D 운영비', percent: 25, amount: '2,500만', desc: 'Gemini/Nano Banana 토큰 · 데이터 수집 · 신규 기능 개발', color: 'primary' },
                { use: '인프라 & 사무 운영', percent: 20, amount: '2,000만', desc: 'Supabase · 서버 · 사무실 임대 · 기장/세무', color: 'sky' },
                { use: '외주 · 파트타임', percent: 15, amount: '1,500만', desc: '디자인/콘텐츠/B2B 영업 외주 (창업자 1인 + 외주 운영)', color: 'purple' },
                { use: '예비비 & 법무', percent: 10, amount: '1,000만', desc: '계약/IP 법률 자문 · 우발 비용 · 보험', color: 'muted-foreground' },
              ].map((it, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-korean">
                    <span className="font-semibold">{it.use}</span>
                    <span className={cn('font-bold', `text-${it.color}`)}>{it.percent}% · ₩{it.amount}</span>
                  </div>
                  <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', `bg-${it.color}`)} style={{ width: `${it.percent}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground font-korean">{it.desc}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t text-[11px] text-muted-foreground font-korean">
              월평균 소진 ≈ ₩555만 · 18개월 운용 시 BEP 도달(MAU 1만) 가능
            </div>
          </div>
          <div className="p-5 bg-gradient-to-br from-primary/10 to-coral/5 rounded-xl border border-primary/30">
            <h4 className="font-bold mb-3 font-korean">🎯 18개월 핵심 마일스톤</h4>
            <div className="space-y-2">
              {[
                { kpi: 'MAU 10,000 달성', desc: '1인 운영 BEP 도달 시점', current: '현재 → 10,000+' },
                { kpi: '월 매출 ₩3,000만', desc: '어필리에이트 중심 수익화', current: '0 → ₩30M/월' },
                { kpi: 'B2B 파일럿 5곳', desc: 'Cafe24·중소형 자사몰 위젯 도입', current: '0 → 5곳' },
                { kpi: '상품 카탈로그 10,000+', desc: 'DNA 자동 분석 파이프라인 확장', current: '5,579 → 10,000+' },
                { kpi: 'Series A 준비', desc: 'M18 시점 후속 라운드 IR 시작', current: '준비' },
              ].map((m, i) => (
                <div key={i} className="p-2 bg-card/70 rounded-lg">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-xs font-korean text-primary">{m.kpi}</span>
                    <span className="text-[10px] text-muted-foreground">{m.current}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-korean mt-0.5">{m.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { label: '월 평균 운영비', value: '₩555만', desc: '고정비 + 변동비 + 마케팅 가중평균', color: 'primary' },
            { label: '예상 런웨이', value: '18개월', desc: 'MAU 1만 BEP 도달까지 충분', color: 'coral' },
            { label: '추가 라운드', value: 'Series A', desc: 'M15~M18 시점 후속 투자 유치', color: 'sky' },
          ].map((s, i) => (
            <div key={i} className={cn('p-3 rounded-xl border text-center', `bg-${s.color}/5 border-${s.color}/30`)}>
              <div className="text-[10px] tracking-widest font-bold font-korean mb-1 text-muted-foreground">{s.label}</div>
              <div className={cn('text-2xl font-bold mb-1', `text-${s.color}`)}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground font-korean">{s.desc}</div>
            </div>
          ))}
        </div>
        <div className="text-center pt-2 space-y-1">
          <p className="text-xl font-bold font-korean bg-gradient-brand bg-clip-text text-transparent">
            쇼미룩과 함께 패션 테크의 미래를 여세요
          </p>
          <p className="text-sm text-muted-foreground">Let's Build Together</p>
          <div className="flex justify-center gap-6 text-xs text-muted-foreground pt-2">
            <span>contact@showmelook.com</span>
            <span className="opacity-50">|</span>
            <span>www.showmelook.com</span>
          </div>
        </div>
      </div>
    ),
    background: 'bg-gradient-hero'
  }
];

const Pitch = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentSlide(index);
    }
  }, []);

  const nextSlide = useCallback(() => {
    goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          document.exitFullscreen?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide, isFullscreen]);

  // 풀스크린 토글
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const slide = slides[currentSlide];

  return (
    <div className={cn('min-h-screen flex flex-col', slide.background)}>
      {/* 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-50 p-4 flex items-center justify-between bg-background/80 backdrop-blur-sm">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <Home className="w-4 h-4 mr-2" />
          홈으로
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {currentSlide + 1} / {slides.length}
          </span>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* 슬라이드 컨텐츠 */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 md:px-12">
        <div className="w-full max-w-5xl">
          {/* 슬라이드 타이틀 (커버 슬라이드는 본문 내에 자체 타이틀) */}
          {currentSlide !== 0 && currentSlide !== slides.length - 1 && (
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold mb-2 font-korean">{slide.title}</h2>
              <p className="text-lg text-muted-foreground font-korean">{slide.subtitle}</p>
            </div>
          )}

          {/* 슬라이드 본문 */}
          <div className="animate-fade-in">
            {slide.content}
          </div>
        </div>
      </main>

      {/* 네비게이션 */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <Button
            variant="ghost"
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            이전
          </Button>

          {/* 슬라이드 인디케이터 */}
          <div className="flex items-center gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className="p-1"
              >
                <Circle
                  className={cn(
                    'w-2 h-2 transition-all',
                    index === currentSlide
                      ? 'fill-primary text-primary scale-125'
                      : 'text-muted-foreground hover:text-primary'
                  )}
                />
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            onClick={nextSlide}
            disabled={currentSlide === slides.length - 1}
            className="gap-2"
          >
            다음
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default Pitch;
