/**
 * Pitch - 투자 제안서 슬라이드 페이지
 * 키보드 좌우 화살표, 스와이프, 클릭으로 슬라이드 전환
 */

import { useState, useEffect, useCallback } from 'react';
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

// 슬라이드 데이터
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
          <h1 className="text-6xl md:text-8xl font-bold bg-gradient-brand bg-clip-text text-transparent font-korean leading-tight">
            쇼미룩
          </h1>
          <p className="text-2xl md:text-3xl font-semibold font-korean">
            나만의 스타일을 <span className="bg-gradient-brand bg-clip-text text-transparent">AI</span>가 완성합니다
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
            <span className="text-coral font-semibold text-sm">1,652+ 상품 DNA 분석</span>
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
            { metric: '등록 상품 수', value: '1,652', desc: '실시간 카탈로그', accent: 'coral' },
            { metric: 'AI DNA 분석', value: '1,652', desc: '스타일 속성 추출 완료', accent: 'sky' },
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
              {['AI 스타일 추천 v8.0', '얼굴 합성 가상 피팅', '1,652+ 상품 카탈로그', '딥링크 어필리에이트', '구매 기반 5등급제', '가족/모델 프로필', '커뮤니티 갤러리', '실시간 어드민 대시보드'].map((f, i) => (
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
    id: 5,
    title: '기술 스택',
    subtitle: '시스템 아키텍처',
    content: (
      <div className="space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { layer: '프론트엔드', tech: 'React + Vite + Tailwind', color: 'bg-sky/20 border-sky/50' },
            { layer: 'Edge Functions', tech: 'Deno (style-recommend, generate-style)', color: 'bg-coral/20 border-coral/50' },
            { layer: 'AI Gateway', tech: 'Gemini 2.5/3 + GPT-5 Fallback', color: 'bg-purple/20 border-purple/50' },
            { layer: 'Backend', tech: 'Supabase (PostgreSQL + Auth + Storage)', color: 'bg-primary/20 border-primary/50' }
          ].map((item, i) => (
            <div key={i} className={cn('p-4 rounded-xl border text-center', item.color)}>
              <div className="text-sm font-semibold mb-1 font-korean">{item.layer}</div>
              <div className="text-xs text-muted-foreground">{item.tech}</div>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <div className="p-4 bg-card rounded-lg border border-border">
            <h4 className="font-bold mb-2 font-korean">🧠 AI 추천 엔진 v8.0</h4>
            <ul className="text-sm text-muted-foreground space-y-1 font-korean">
              <li>• 피드백 기반 자기 학습</li>
              <li>• 크로스 모델 폴백 시스템</li>
              <li>• 다단계 캐싱 (L1~L4)</li>
            </ul>
          </div>
          <div className="p-4 bg-card rounded-lg border border-border">
            <h4 className="font-bold mb-2 font-korean">💰 비용 최적화</h4>
            <ul className="text-sm text-muted-foreground space-y-1 font-korean">
              <li>• 이미지 생성: ~50원/장</li>
              <li>• 캐시 히트율 목표: 70%</li>
              <li>• 실효 비용: ~15원/장</li>
            </ul>
          </div>
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 6,
    title: '비즈니스 모델',
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
    id: 7,
    title: '비용 구조 & BEP',
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
    id: 8,
    title: '12개월 현금흐름',
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
    id: 9,
    title: '시장 분석',
    subtitle: 'TAM / SAM / SOM',
    content: (
      <div className="flex flex-col items-center space-y-6">
        <div className="w-full max-w-md space-y-4">
          {[
            { label: 'TAM', value: '58조원', desc: '한국 패션 이커머스 시장', width: '100%', color: 'bg-primary/30' },
            { label: 'SAM', value: '5.8조원', desc: '스타일링 니즈 시장', width: '60%', color: 'bg-primary/50' },
            { label: 'SOM', value: '280억원', desc: '5년 목표 시장 점유', width: '30%', color: 'bg-primary' }
          ].map((item, i) => (
            <div key={i} className="relative">
              <div 
                className={cn('p-4 rounded-lg text-white', item.color)} 
                style={{ width: item.width }}
              >
                <div className="font-bold">{item.label}: {item.value}</div>
                <div className="text-sm opacity-90 font-korean">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full mt-4">
          {['Gen Z 소비력 증가', 'AI 기술 대중화', '메타버스/AR 확산', '지속가능성 관심'].map((trend, i) => (
            <div key={i} className="p-3 bg-card rounded-lg border border-border text-center">
              <span className="text-sm font-korean">🚀 {trend}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 10,
    title: '경쟁 우위',
    subtitle: '핵심 차별화 요소',
    content: (
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {[
            { title: 'AI 기술 내재화', items: ['자체 추천 엔진 v8.0', '크로스 모델 폴백', '피드백 기반 학습'] },
            { title: '완전한 구매 연동', items: ['1,400+ 상품 카탈로그', '딥링크 원클릭 구매', '실시간 재고 동기화'] }
          ].map((section, i) => (
            <div key={i} className="p-4 bg-card rounded-lg border border-border">
              <h4 className="font-bold mb-2 font-korean">✅ {section.title}</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {section.items.map((item, j) => (
                  <li key={j} className="font-korean">• {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="p-6 bg-primary/5 rounded-xl border border-primary/20">
          <h4 className="font-bold mb-4 font-korean">🏰 MOAT (진입 장벽)</h4>
          <div className="space-y-3 text-sm font-korean">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚙️</span>
              <span><strong>기술:</strong> 1년+ 개발 투자</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <span><strong>데이터:</strong> 피드백 누적 → 품질 상승</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🤝</span>
              <span><strong>파트너:</strong> 머천트 제휴 네트워크</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎨</span>
              <span><strong>UX:</strong> 사용자 습관 형성</span>
            </div>
          </div>
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 11,
    title: '로드맵',
    subtitle: '현재 80% 완료',
    content: (
      <div className="space-y-6">
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <h4 className="font-bold text-green-600 mb-2 font-korean">✅ 완료된 기능 (Phase 1-4)</h4>
          <div className="flex flex-wrap gap-2">
            {['AI 추천 v8.0', '가상 피팅', '딥링크 연동', '1,400+ 상품', '피드백 학습', '구매 등급제', '가족 프로필'].map((item, i) => (
              <span key={i} className="px-3 py-1 bg-green-500/20 text-green-700 rounded-full text-sm font-korean">{item}</span>
            ))}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-card rounded-lg border border-border">
            <h4 className="font-bold mb-2 font-korean">📅 Q1 2026 (1-3월)</h4>
            <ul className="text-sm text-muted-foreground space-y-1 font-korean">
              <li>• Phase 5: 실시간 재고 확인</li>
              <li>• 상품 2,000+ 확장</li>
              <li>• A/B 테스트 최적화</li>
            </ul>
          </div>
          <div className="p-4 bg-card rounded-lg border border-border">
            <h4 className="font-bold mb-2 font-korean">📅 Q2 2026 (4-6월)</h4>
            <ul className="text-sm text-muted-foreground space-y-1 font-korean">
              <li>• 결제 연동 (Stripe/Toss)</li>
              <li>• Cafe24 앱스토어 출시</li>
              <li>• B2B 파트너 10곳 확보</li>
            </ul>
          </div>
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 12,
    title: '투자 요청',
    subtitle: 'Seed Round',
    content: (
      <div className="space-y-6">
        {/* 투자 목표 금액 */}
        <div className="text-center">
          <div className="inline-block p-6 bg-gradient-brand rounded-2xl">
            <div className="text-white">
              <div className="text-4xl md:text-5xl font-bold mb-1">5억원</div>
              <div className="text-base opacity-90 font-korean">Seed 투자 유치 목표</div>
            </div>
          </div>
        </div>

        {/* 자금 사용 계획 */}
        <div className="grid grid-cols-4 gap-3 max-w-2xl mx-auto">
          {[
            { use: '제품 개발', percent: '40%', amount: '2억' },
            { use: '마케팅', percent: '30%', amount: '1.5억' },
            { use: '인력 채용', percent: '20%', amount: '1억' },
            { use: '운영 비용', percent: '10%', amount: '0.5억' }
          ].map((item, i) => (
            <div key={i} className="p-3 bg-card rounded-lg border border-border text-center">
              <div className="text-xl font-bold text-primary">{item.percent}</div>
              <div className="text-sm font-semibold font-korean">{item.use}</div>
              <div className="text-xs text-muted-foreground">{item.amount}</div>
            </div>
          ))}
        </div>

        {/* 12개월 후 목표 KPI */}
        <div className="p-4 bg-primary/5 rounded-xl max-w-3xl mx-auto">
          <h4 className="font-bold mb-3 text-center font-korean">📊 12개월 후 목표 KPI</h4>
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {[
              { metric: 'MAU', current: '100', target: '20,000', unit: '명' },
              { metric: '구매전환 사용자', current: '0', target: '3,000', unit: '명' },
              { metric: '월 수수료 수익', current: '0', target: '630', unit: '만원' },
              { metric: '상품 카탈로그', current: '1,400', target: '5,000', unit: '+' },
              { metric: 'B2B 파트너', current: '0', target: '10', unit: '곳' }
            ].map((kpi, i) => (
              <div key={i} className="p-2 bg-card rounded-lg border border-border">
                <div className="font-semibold font-korean mb-1">{kpi.metric}</div>
                <div className="text-muted-foreground">{kpi.current}</div>
                <div className="text-primary">→</div>
                <div className="font-bold text-primary">{kpi.target}{kpi.unit}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground text-center mt-2 font-korean">
            * 구매전환율 15% 기준 (MAU 20,000 × 15% × 7만원 × 3% = 월 ₩630만)
          </div>
        </div>

        {/* 연락처 */}
        <div className="text-center pt-2">
          <p className="text-lg text-muted-foreground font-korean">
            "함께 패션의 미래를 만들어갑니다"
          </p>
          <p className="text-primary font-bold mt-1">contact@showmelook.com</p>
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
          {/* 슬라이드 타이틀 */}
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-2 font-korean">{slide.title}</h2>
            <p className="text-lg text-muted-foreground font-korean">{slide.subtitle}</p>
          </div>

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
