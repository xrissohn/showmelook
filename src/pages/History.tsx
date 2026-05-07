/**
 * History - 생성한 룩을 날짜별로 모아 다시 열람할 수 있는 히스토리 페이지
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar as CalendarIcon, ImageOff, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useGeneratedLooks } from '@/hooks/useGeneratedLooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SEOHead } from '@/components/SEOHead';

const formatDateKey = (iso: string) => {
  const d = new Date(iso);
  // KST 기준 YYYY-MM-DD
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
};

const formatDateLabel = (key: string) => {
  const today = formatDateKey(new Date().toISOString());
  const yesterday = formatDateKey(new Date(Date.now() - 86400000).toISOString());
  if (key === today) return '오늘';
  if (key === yesterday) return '어제';
  const d = new Date(key);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${['일','월','화','수','목','금','토'][d.getDay()]})`;
};

const History = () => {
  const { user, loading: authLoading } = useAuth();
  const { looks, isLoading } = useGeneratedLooks();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof looks>();
    looks.forEach((l) => {
      const key = formatDateKey(l.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [looks]);

  const visibleGroups = selectedDate
    ? grouped.filter(([key]) => key === selectedDate)
    : grouped;

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md mx-4">
          <CardContent className="p-8 text-center space-y-4">
            <Sparkles className="w-12 h-12 mx-auto text-primary" />
            <h1 className="text-xl font-bold font-korean">로그인이 필요해요</h1>
            <p className="text-sm text-muted-foreground font-korean">
              내가 생성한 룩 히스토리를 보려면 로그인해 주세요.
            </p>
            <Button onClick={() => navigate('/auth')} className="w-full">로그인</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="내 생성 히스토리 | ShowMeLook"
        description="이전에 생성한 룩 4종 갤러리를 날짜별로 모아 다시 열람할 수 있어요."
      />

      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="뒤로">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-base md:text-lg font-bold font-korean flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-primary" />
              내 생성 히스토리
            </h1>
            <p className="text-[11px] text-muted-foreground font-korean">
              날짜별로 모인 내 룩 갤러리 · 클릭하면 상세 보기
            </p>
          </div>
          <Button size="sm" onClick={() => navigate('/style')} className="font-korean">
            새 룩 생성
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Date filter chips */}
        {grouped.length > 0 && (
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedDate(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-korean whitespace-nowrap border transition-colors ${
                !selectedDate
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              전체 ({looks.length})
            </button>
            {grouped.map(([key, items]) => (
              <button
                key={key}
                onClick={() => setSelectedDate(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-korean whitespace-nowrap border transition-colors ${
                  selectedDate === key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {formatDateLabel(key)} · {items.length}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <div key={i}>
                <Skeleton className="h-5 w-32 mb-3" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="aspect-[3/4] rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && grouped.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center space-y-3">
              <ImageOff className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="font-korean text-sm text-muted-foreground">
                아직 생성한 룩이 없어요. 첫 번째 룩을 만들어 볼까요?
              </p>
              <Button onClick={() => navigate('/style')} className="font-korean">
                룩 생성하러 가기
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Grouped looks */}
        {!isLoading && visibleGroups.map(([dateKey, items]) => (
          <section key={dateKey} className="mb-8">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm md:text-base font-bold font-korean">
                {formatDateLabel(dateKey)}
              </h2>
              <span className="text-[11px] text-muted-foreground font-korean">
                룩 {items.length}개
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {items.map((look) => (
                <Link
                  key={look.id}
                  to={`/look/${look.id}`}
                  className="group relative aspect-[3/4] rounded-lg overflow-hidden bg-muted border border-border hover:border-primary transition-colors"
                >
                  <img
                    src={look.image_url}
                    alt={look.caption || look.prompt_used || '생성된 룩'}
                    className="w-full h-full object-contain bg-muted"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white font-korean line-clamp-2">
                      {look.caption || look.prompt_used || '룩'}
                    </p>
                  </div>
                  {look.is_favorite && (
                    <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-coral text-white font-bold">
                      ★
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
};

export default History;
