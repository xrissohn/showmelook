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

// 슬라이드 데이터
const slides = [
  {
    id: 1,
    title: '쇼미룩',
    subtitle: 'AI 기반 가상 피팅 & 스타일 추천 플랫폼',
    content: (
      <div className="text-center space-y-8">
        <h1 className="text-5xl md:text-7xl font-bold bg-gradient-brand bg-clip-text text-transparent font-korean">
          쇼미룩
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground font-korean">
          "입어보지 않아도 나를 아는 AI 스타일리스트"
        </p>
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          <div className="px-6 py-3 bg-primary/10 rounded-full">
            <span className="text-primary font-semibold">플랫폼 완성도 80%</span>
          </div>
          <div className="px-6 py-3 bg-coral/10 rounded-full">
            <span className="text-coral font-semibold">1,400+ 상품</span>
          </div>
          <div className="px-6 py-3 bg-sky/10 rounded-full">
            <span className="text-sky font-semibold">Gemini AI 기반</span>
          </div>
        </div>
      </div>
    ),
    background: 'bg-gradient-hero'
  },
  {
    id: 2,
    title: '문제 정의',
    subtitle: '패션 이커머스의 핵심 Pain Points',
    content: (
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-coral font-korean">소비자 관점</h3>
          <ul className="space-y-3">
            {[
              '"이 옷이 나한테 어울릴까?" - 구매 망설임',
              '"사이즈가 맞을까?" - 반품률 30~40%',
              '"뭘 입어야 할지 모르겠다" - 스타일링 고민',
              '"매번 비슷한 옷만 산다" - 새로운 시도 어려움'
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-muted-foreground font-korean">
                <span className="text-red-500">🔴</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-sky font-korean">시장 데이터</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: '68%', label: '사이즈/핏 불안 경험' },
              { value: '30-40%', label: '의류 반품률' },
              { value: '수조원', label: '연간 반품 손실' },
              { value: '+10%', label: '전환율 1%p 효과' }
            ].map((stat, i) => (
              <div key={i} className="p-4 bg-card rounded-lg border border-border text-center">
                <div className="text-2xl font-bold text-primary">{stat.value}</div>
                <div className="text-xs text-muted-foreground font-korean">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 3,
    title: '솔루션',
    subtitle: '쇼미룩의 3단계 해결책',
    content: (
      <div className="grid md:grid-cols-3 gap-6">
        {[
          {
            step: 'Step 1',
            title: 'AI 스타일 컨설팅',
            icon: '🎨',
            items: ['체형/키/몸무게 기반 핏 추천', 'TPO 맞춤 스타일링', '10개 스타일 컨셉']
          },
          {
            step: 'Step 2',
            title: '가상 피팅',
            icon: '👗',
            items: ['Gemini 기반 얼굴 합성', '체형 맞춤 시뮬레이션', '1분 내 결과 확인']
          },
          {
            step: 'Step 3',
            title: '원클릭 구매',
            icon: '🛒',
            items: ['딥링크 연동', '실시간 재고/가격', '장바구니 담기']
          }
        ].map((step, i) => (
          <div key={i} className="p-6 bg-card rounded-xl border border-border hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-4">{step.icon}</div>
            <div className="text-xs text-primary font-semibold mb-2">{step.step}</div>
            <h3 className="text-lg font-bold mb-3 font-korean">{step.title}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {step.items.map((item, j) => (
                <li key={j} className="flex items-center gap-2 font-korean">
                  <span className="text-primary">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 4,
    title: '제품 소개',
    subtitle: '핵심 화면 구성',
    content: (
      <div className="grid md:grid-cols-2 gap-6">
        {[
          {
            title: '🏠 랜딩 페이지',
            desc: '3D 플립 카드 갤러리, 10가지 스타일 컨셉'
          },
          {
            title: '👗 스타일 생성기',
            desc: '프롬프트 입력 → AI 추천 → 4개 카테고리 자동 선택'
          },
          {
            title: '💎 요금제 페이지',
            desc: 'Free / Pro ₩4,900 / Premium ₩9,900'
          },
          {
            title: '📊 어드민 대시보드',
            desc: '상품 DNA 편집, AI 성능 모니터링'
          }
        ].map((item, i) => (
          <div key={i} className="p-6 bg-card rounded-xl border border-border">
            <h3 className="text-xl font-bold mb-2 font-korean">{item.title}</h3>
            <p className="text-muted-foreground font-korean">{item.desc}</p>
          </div>
        ))}
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
          {/* B2C 구독 */}
          <div className="p-4 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">💳</span>
              <h4 className="font-bold font-korean">B2C 구독</h4>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 bg-muted/30 rounded">
                <span className="font-korean">Free</span>
                <span className="font-semibold">₩0</span>
              </div>
              <div className="flex justify-between p-2 bg-sky/10 rounded">
                <span className="font-korean">Pro (월/연)</span>
                <span className="font-semibold text-sky">₩4,900 / ₩49,000</span>
              </div>
              <div className="flex justify-between p-2 bg-coral/10 rounded">
                <span className="font-korean">Premium (월/연)</span>
                <span className="font-semibold text-coral">₩9,900 / ₩99,000</span>
              </div>
              <div className="text-muted-foreground font-korean pt-1 border-t">
                전환율 목표: Free→Pro <strong>15%</strong>, Pro→Premium <strong>20%</strong>
              </div>
            </div>
          </div>

          {/* 어필리에이트 */}
          <div className="p-4 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🔗</span>
              <h4 className="font-bold font-korean">어필리에이트</h4>
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
                <div>월 10만 클릭 × 구매전환 3%</div>
                <div>× 평균주문 5만원 × 수수료 3%</div>
                <div className="text-primary font-bold mt-1">= 월 450만원</div>
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
                  <td className="p-2 font-korean">B2C 구독</td>
                  <td className="p-2 text-center">1</td>
                  <td className="p-2 text-center">10</td>
                  <td className="p-2 text-center">50</td>
                  <td className="p-2 text-center">100</td>
                  <td className="p-2 text-center">200</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="p-2 font-korean">어필리에이트</td>
                  <td className="p-2 text-center">0.1</td>
                  <td className="p-2 text-center">1</td>
                  <td className="p-2 text-center">5</td>
                  <td className="p-2 text-center">10</td>
                  <td className="p-2 text-center">20</td>
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
                  <td className="p-2 text-center text-primary">1.1</td>
                  <td className="p-2 text-center text-primary">13</td>
                  <td className="p-2 text-center text-primary">65</td>
                  <td className="p-2 text-center text-primary">140</td>
                  <td className="p-2 text-center text-primary">280</td>
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
          </div>
        </div>
      </div>
    ),
    background: 'bg-background'
  },
  {
    id: 7,
    title: '시장 분석',
    subtitle: 'TAM / SAM / SOM',
    content: (
      <div className="flex flex-col items-center space-y-6">
        <div className="w-full max-w-md space-y-4">
          {[
            { label: 'TAM', value: '58조원', desc: '한국 패션 이커머스 시장', width: '100%', color: 'bg-primary/30' },
            { label: 'SAM', value: '5.8조원', desc: '스타일링 니즈 시장', width: '60%', color: 'bg-primary/50' },
            { label: 'SOM', value: '580억원', desc: '5년 목표 시장 점유', width: '30%', color: 'bg-primary' }
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
    id: 8,
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
    id: 9,
    title: '로드맵',
    subtitle: '현재 80% 완료',
    content: (
      <div className="space-y-6">
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <h4 className="font-bold text-green-600 mb-2 font-korean">✅ 완료된 기능 (Phase 1-4)</h4>
          <div className="flex flex-wrap gap-2">
            {['AI 추천 v8.0', '가상 피팅', '딥링크 연동', '1,400+ 상품', '피드백 학습', '구독 플랜', '가족 프로필'].map((item, i) => (
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
    id: 10,
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
              { metric: 'MAU', current: '100', target: '10,000', unit: '명' },
              { metric: '유료 구독자', current: '0', target: '1,500', unit: '명' },
              { metric: 'MRR', current: '0', target: '1,000', unit: '만원' },
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
            * 전환율 15% 기준 (MAU 10,000 × 15% = 유료 1,500명)
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
