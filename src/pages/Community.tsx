import { useEffect, useRef, useMemo } from 'react';
import { useCommunityFeed } from '@/hooks/useCommunityFeed';
import { useLookLikes } from '@/hooks/useLookLikes';
import LookCard from '@/components/community/LookCard';
import CommunityFilters from '@/components/community/CommunityFilters';
import MainNavigation from '@/components/MainNavigation';
import { SEOHead } from '@/components/SEOHead';
import { Loader2, Images } from 'lucide-react';

const Community = () => {
  const { looks, isLoading, sortBy, setSortBy, hasMore, loadMore, updateLookLikeCount } = useCommunityFeed();
  const lookIds = useMemo(() => looks.map(l => l.id), [looks]);
  const { likedLookIds, toggleLike } = useLookLikes(lookIds);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '300px', threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.unobserve(el);
  }, [hasMore, loadMore]);

  const handleToggleLike = async (lookId: string, currentCount: number) => {
    const result = await toggleLike(lookId, currentCount);
    if (result) {
      updateLookLikeCount(lookId, result.newCount);
    }
  };

  return (
    <>
      <SEOHead
        custom={{
          title: '스타일 갤러리 | 쇼미룩',
          description: 'AI가 만든 다양한 스타일을 구경하고 영감을 얻어보세요.',
          canonical: 'https://showmelook.com/community',
        }}
      />
      <MainNavigation />
      <main className="min-h-screen bg-background pt-16 sm:pt-20">
        <div className="container mx-auto px-3 sm:px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-korean text-foreground flex items-center gap-2">
                <Images className="w-6 h-6 text-primary" />
                스타일 갤러리
              </h1>
              <p className="text-sm text-muted-foreground font-korean mt-1">
                다른 사람들의 AI 스타일을 구경해보세요
              </p>
            </div>
            <CommunityFilters sortBy={sortBy} onSortChange={setSortBy} />
          </div>

          {/* Grid */}
          {isLoading && looks.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : looks.length === 0 ? (
            <div className="text-center py-20">
              <Images className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-lg text-muted-foreground font-korean">
                아직 공개된 스타일이 없습니다
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {looks.map((look) => (
                <LookCard
                  key={look.id}
                  look={look}
                  isLiked={likedLookIds.has(look.id)}
                  onToggleLike={handleToggleLike}
                />
              ))}
            </div>
          )}

          {/* Load more trigger */}
          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!hasMore && looks.length > 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground font-korean">
                모든 스타일을 불러왔습니다 ✨
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
};

export default Community;
