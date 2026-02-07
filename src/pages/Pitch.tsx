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

// BEP 차트 데이터 (구매 기반 등급제: ARPU ₩525, 변동비 ~₩400/명)
// 인원별 고정비: 1명 215만, 2명 815만, 3명 1,415만, 4명 2,015만
const bepChartData = [
  { users: 0, revenue: 0, cost: 215, profit: -215, staff: 1 },
  { users: 1000, revenue: 53, cost: 255, profit: -202, staff: 1 },
  { users: 3000, revenue: 158, cost: 335, profit: -177, staff: 1 },
  { users: 5400, revenue: 284, cost: 431, profit: -147, staff: 1 }, // BEP 근처 (1인)
  { users: 7000, revenue: 368, cost: 495, profit: -127, staff: 1 },
  { users: 10000, revenue: 525, cost: 1215, profit: -690, staff: 2 },
  { users: 15000, revenue: 788, cost: 1415, profit: -627, staff: 2 },
  { users: 20500, revenue: 1076, cost: 1635, profit: -559, staff: 2 }, // BEP (2인)
  { users: 30000, revenue: 1575, cost: 2615, profit: -1040, staff: 3 },
];

// 12개월 현금흐름 데이터 (ARPU ₩525, 변동비 ~₩400/명, 5,000명 돌파 시 1명 채용)
const cashflowChartData = [
  { month: 'M1', users: 100, staff: 1, revenue: 5, fixedCost: 215, variableCost: 4, totalCost: 219, profit: -214, cumulative: -214 },
  { month: 'M2', users: 250, staff: 1, revenue: 13, fixedCost: 215, variableCost: 10, totalCost: 225, profit: -212, cumulative: -426 },
  { month: 'M3', users: 500, staff: 1, revenue: 26, fixedCost: 215, variableCost: 20, totalCost: 235, profit: -209, cumulative: -635 },
  { month: 'M4', users: 900, staff: 1, revenue: 47, fixedCost: 215, variableCost: 36, totalCost: 251, profit: -204, cumulative: -839 },
  { month: 'M5', users: 1500, staff: 1, revenue: 79, fixedCost: 215, variableCost: 60, totalCost: 275, profit: -196, cumulative: -1035 },
  { month: 'M6', users: 2500, staff: 1, revenue: 131, fixedCost: 215, variableCost: 100, totalCost: 315, profit: -184, cumulative: -1219 },
  { month: 'M7', users: 3800, staff: 1, revenue: 200, fixedCost: 215, variableCost: 152, totalCost: 367, profit: -167, cumulative: -1386 },
  { month: 'M8', users: 5200, staff: 1, revenue: 273, fixedCost: 215, variableCost: 208, totalCost: 423, profit: -150, cumulative: -1536 },
  { month: 'M9', users: 7000, staff: 2, revenue: 368, fixedCost: 815, variableCost: 280, totalCost: 1095, profit: -727, cumulative: -2263 },
  { month: 'M10', users: 9000, staff: 2, revenue: 473, fixedCost: 815, variableCost: 360, totalCost: 1175, profit: -702, cumulative: -2965 },
  { month: 'M11', users: 12000, staff: 2, revenue: 630, fixedCost: 815, variableCost: 480, totalCost: 1295, profit: -665, cumulative: -3630 },
  { month: 'M12', users: 15000, staff: 2, revenue: 788, fixedCost: 815, variableCost: 600, totalCost: 1415, profit: -627, cumulative: -4257 },
];

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
            title: '💎 등급제 페이지',
            desc: '구매 기반 5단계 등급 (Free → Bronze → Silver → Gold → Platinum)'
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
                <div>구매전환율 25% × 평균주문 7만원</div>
                <div>× 수수료 3%</div>
                <div className="text-primary font-bold mt-1">ARPU = ₩525/사용자/월</div>
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
                  <td className="p-2 text-center">0.6</td>
                  <td className="p-2 text-center">6</td>
                  <td className="p-2 text-center">30</td>
                  <td className="p-2 text-center">60</td>
                  <td className="p-2 text-center">120</td>
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
                  <td className="p-2 text-center text-primary">0.6</td>
                  <td className="p-2 text-center text-primary">8</td>
                  <td className="p-2 text-center text-primary">40</td>
                  <td className="p-2 text-center text-primary">90</td>
                  <td className="p-2 text-center text-primary">180</td>
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
                <span>Free (60%)</span>
                <span className="font-semibold">₩250</span>
              </div>
              <div className="flex justify-between p-1.5 bg-amber-500/10 rounded">
                <span>Bronze (20%)</span>
                <span className="font-semibold text-amber-600">₩450</span>
              </div>
              <div className="flex justify-between p-1.5 bg-slate-300/20 rounded">
                <span>Silver (12%)</span>
                <span className="font-semibold text-slate-500">₩680</span>
              </div>
              <div className="flex justify-between p-1.5 bg-yellow-500/10 rounded">
                <span>Gold+ (8%)</span>
                <span className="font-semibold text-yellow-600">₩950</span>
              </div>
              <div className="pt-1 border-t text-muted-foreground">
                가중 평균: <strong className="text-primary">~₩400/명</strong>
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
              <div className="text-3xl font-bold text-primary">~5,400명</div>
              <div className="text-xs text-muted-foreground font-korean">1인 손익분기점</div>
              <div className="text-sm font-semibold text-coral mt-1">(구매전환 ~1,350명)</div>
            </div>
            <div className="space-y-1.5 text-xs font-korean pt-2 border-t">
              <div className="flex justify-between">
                <span>2인 팀</span>
                <span className="font-bold text-sky">~20,500명</span>
              </div>
              <div className="flex justify-between">
                <span>ARPU</span>
                <span className="font-bold text-primary">₩525/명/월</span>
              </div>
              <div className="flex justify-between">
                <span>변동비</span>
                <span className="font-bold text-primary">~₩400/명</span>
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
                  <ReferenceLine x={5400} stroke="hsl(var(--coral))" strokeDasharray="5 5" label={{ value: 'BEP(1인)', fontSize: 9, fill: 'hsl(var(--coral))' }} />
                  <ReferenceLine x={20500} stroke="hsl(var(--sky))" strokeDasharray="5 5" label={{ value: 'BEP(2인)', fontSize: 9, fill: 'hsl(var(--sky))' }} />
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
                    <td className="p-1.5 font-korean">1,000명</td>
                    <td className="p-1.5 text-center">1명</td>
                    <td className="p-1.5 text-center">₩53만</td>
                    <td className="p-1.5 text-center">₩255만</td>
                    <td className="p-1.5 text-center text-coral font-semibold">-₩202만</td>
                    <td className="p-1.5 text-center text-muted-foreground">-</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-1.5 font-korean">3,000명</td>
                    <td className="p-1.5 text-center">1명</td>
                    <td className="p-1.5 text-center">₩158만</td>
                    <td className="p-1.5 text-center">₩335만</td>
                    <td className="p-1.5 text-center text-coral font-semibold">-₩177만</td>
                    <td className="p-1.5 text-center text-muted-foreground">-</td>
                  </tr>
                  <tr className="border-b border-border/50 bg-coral/5">
                    <td className="p-1.5 font-korean">~5,400명 <span className="text-coral">(BEP)</span></td>
                    <td className="p-1.5 text-center">1명</td>
                    <td className="p-1.5 text-center">₩284만</td>
                    <td className="p-1.5 text-center">₩431만</td>
                    <td className="p-1.5 text-center text-muted-foreground">~₩0</td>
                    <td className="p-1.5 text-center">~0%</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-1.5 font-korean">10,000명</td>
                    <td className="p-1.5 text-center">2명</td>
                    <td className="p-1.5 text-center">₩525만</td>
                    <td className="p-1.5 text-center">₩1,215만</td>
                    <td className="p-1.5 text-center text-coral font-semibold">-₩690만</td>
                    <td className="p-1.5 text-center text-muted-foreground">-</td>
                  </tr>
                  <tr className="border-b border-border/50 bg-sky/5">
                    <td className="p-1.5 font-korean">~20,500명 <span className="text-sky">(BEP 2인)</span></td>
                    <td className="p-1.5 text-center">2명</td>
                    <td className="p-1.5 text-center">₩1,076만</td>
                    <td className="p-1.5 text-center">₩1,635만</td>
                    <td className="p-1.5 text-center text-muted-foreground">~₩0</td>
                    <td className="p-1.5 text-center">~0%</td>
                  </tr>
                  <tr className="bg-primary/10 font-bold">
                    <td className="p-1.5 font-korean">30,000명</td>
                    <td className="p-1.5 text-center">3명</td>
                    <td className="p-1.5 text-center">₩1,575만</td>
                    <td className="p-1.5 text-center">₩2,615만</td>
                    <td className="p-1.5 text-center text-coral">-₩1,040만</td>
                    <td className="p-1.5 text-center text-muted-foreground">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 핵심 가정 */}
        <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground font-korean">
          <span className="px-2 py-1 bg-muted/50 rounded-full">📌 ARPU ₩525/명 (어필리에이트)</span>
          <span className="px-2 py-1 bg-muted/50 rounded-full">📌 변동비 ~₩400/명</span>
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
            <div className="text-xs text-muted-foreground font-korean mt-1">M1~M8 (5,000명 미만)</div>
          </div>
          {/* 2인 고정비 */}
          <div className="p-3 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">👥</span>
              <h4 className="font-bold text-sm font-korean">2인 고정비</h4>
            </div>
            <div className="text-xl font-bold text-coral">₩815만<span className="text-xs font-normal text-muted-foreground">/월</span></div>
            <div className="text-xs text-muted-foreground font-korean mt-1">M9~M12 (5,000명 초과)</div>
          </div>
          {/* 변동 비용 */}
          <div className="p-3 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📊</span>
              <h4 className="font-bold text-sm font-korean">사용자당 비용</h4>
            </div>
            <div className="text-xl font-bold text-sky">~₩400<span className="text-xs font-normal text-muted-foreground">/명</span></div>
            <div className="text-xs text-muted-foreground font-korean mt-1">가중 평균 변동비</div>
          </div>
          {/* 초기 자본금 */}
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">💰</span>
              <h4 className="font-bold text-sm font-korean">권장 자본금</h4>
            </div>
            <div className="text-xl font-bold text-primary">₩1,500~2,000만</div>
            <div className="text-xs text-muted-foreground font-korean mt-1">최대손실(₩4,257만) 대비</div>
          </div>
        </div>

        {/* ComposedChart */}
        <div className="p-4 bg-card rounded-lg border border-border">
          <h4 className="font-bold mb-3 font-korean">📈 월별 순이익 & 누적 손익 (5,000명 채용)</h4>
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
                  x="M9" 
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
                      row.month === 'M6' && 'bg-primary/5',
                      row.month === 'M9' && 'bg-coral/10',
                      row.month === 'M12' && 'bg-primary/10 font-bold'
                    )}
                  >
                    <td className="p-1.5 font-korean">
                      {row.month}
                      {row.month === 'M6' && <span className="text-muted-foreground ml-1">(성장)</span>}
                      {row.month === 'M9' && <span className="text-coral ml-1">(채용)</span>}
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
          <span className="px-2 py-1 bg-muted/50 rounded-full">📌 ARPU ₩525/명 (어필리에이트)</span>
          <span className="px-2 py-1 bg-muted/50 rounded-full">📌 5,000명 초과 시 1명 채용</span>
          <span className="px-2 py-1 bg-muted/50 rounded-full">📌 12개월 누적 -₩4,257만 (투자 필요)</span>
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
              { metric: 'MAU', current: '100', target: '15,000', unit: '명' },
              { metric: '구매전환 사용자', current: '0', target: '2,500', unit: '명' },
              { metric: '월 수수료 수익', current: '0', target: '788', unit: '만원' },
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
            * 구매전환율 25% 기준 (MAU 15,000 × 25% × 7만원 × 3% = 월 ₩788만)
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
