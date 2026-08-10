import { useEffect, useRef, useMemo, useState } from 'react';
import { useCommunityFeed } from '@/hooks/useCommunityFeed';
import { useGalleryUsers } from '@/hooks/useGalleryUsers';
import { useLookLikes } from '@/hooks/useLookLikes';
import LookCard from '@/components/community/LookCard';
import GalleryUserCard from '@/components/community/GalleryUserCard';
import CommunityFilters from '@/components/community/CommunityFilters';
import MainNavigation from '@/components/MainNavigation';
import { SEOHead } from '@/components/SEOHead';
import { LookDetailModal, LookDetailData } from '@/components/style/LookDetailModal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Images, LayoutGrid } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdsContentReady } from '@/hooks/useAdsContentReady';

const Community = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('photos');
  const { looks, isLoading, sortBy, setSortBy, hasMore, loadMore, updateLookLikeCount } = useCommunityFeed();
  const { users, isLoading: galleryLoading } = useGalleryUsers();
  const lookIds = useMemo(() => looks.map(l => l.id), [looks]);
  useAdsContentReady(!isLoading && looks.length > 0);
  const { likedLookIds, toggleLike } = useLookLikes(lookIds);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [selectedLook, setSelectedLook] = useState<LookDetailData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMore || activeTab !== 'photos') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '300px', threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.unobserve(el);
  }, [hasMore, loadMore, activeTab]);

  const handleToggleLike = async (lookId: string, currentCount: number) => {
    const result = await toggleLike(lookId, currentCount);
    if (result) {
      updateLookLikeCount(lookId, result.newCount);
    }
  };

  const handleLookClick = (look: typeof looks[0], index: number) => {
    setSelectedLook({
      ...look,
      is_favorite: false,
      is_public: true,
      user_name: look.user_name,
      user_avatar: look.user_avatar,
    });
    setSelectedIndex(index);
  };

  return (
    <>
      <SEOHead
        pageKey="community"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: '쇼미룩 커뮤니티 스타일 갤러리',
          url: 'https://showmelook.com/community',
          description: '쇼미룩 사용자들이 AI로 만든 코디를 공유하는 공개 스타일 갤러리입니다.',
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: looks.length,
            itemListElement: looks.slice(0, 20).map((look, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `https://showmelook.com/look/${look.id}`,
            })),
          },
        }}
      />
      <MainNavigation />
      <main className="min-h-screen bg-background pt-16 sm:pt-20">
        <div className="container mx-auto px-3 sm:px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-korean text-foreground flex items-center gap-2">
                <Images className="w-6 h-6 text-primary" />
                {t('community.title')}
              </h1>
              <p className="text-sm text-muted-foreground font-korean mt-1">
                {t('community.description')}
              </p>
            </div>
            {activeTab === 'photos' && (
              <CommunityFilters sortBy={sortBy} onSortChange={setSortBy} />
            )}
          </div>

          {/* 섹션 소개 */}
          <div className="mb-6 rounded-xl border border-border/60 bg-card/60 p-4">
            <p className="font-korean text-sm leading-relaxed text-muted-foreground break-keep">
              쇼미룩 사용자들이 직접 만들고 공개한 AI 착장을 모아둔 공간입니다.
              사진 탭에서는 최신순·인기순으로 개별 룩을 볼 수 있고, 갤러리 탭에서는
              사용자별 스타일을 이어서 살펴볼 수 있어요. 마음에 드는 룩을 누르면
              사용된 상품 구성과 코디 포인트를 확인할 수 있습니다.
            </p>
            <p className="mt-2 font-korean text-sm text-muted-foreground break-keep">
              코디 기준이 궁금하다면 <a href="/guide" className="text-primary underline">쇼미가 제안하는 스타일 가이드</a>를 먼저 읽어보세요.
            </p>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList>
              <TabsTrigger value="photos" className="font-korean text-xs sm:text-sm gap-1.5">
                <Images className="w-4 h-4" />
                {t('community.byPhoto')}
              </TabsTrigger>
              <TabsTrigger value="galleries" className="font-korean text-xs sm:text-sm gap-1.5">
                <LayoutGrid className="w-4 h-4" />
                {t('community.byGallery')}
              </TabsTrigger>
            </TabsList>

            {/* Photos tab */}
            <TabsContent value="photos">
              {isLoading && looks.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : looks.length === 0 ? (
                <div className="text-center py-20">
                  <Images className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-lg text-muted-foreground font-korean">
                    {t('community.noPublicStyles')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {looks.map((look, index) => (
                    <LookCard
                      key={look.id}
                      look={look}
                      isLiked={likedLookIds.has(look.id)}
                      onToggleLike={handleToggleLike}
                      onClick={() => handleLookClick(look, index)}
                    />
                  ))}
                </div>
              )}

              {hasMore && (
                <div ref={loadMoreRef} className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!hasMore && looks.length > 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground font-korean">
                    {t('community.allLoaded')}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Galleries tab */}
            <TabsContent value="galleries">
              {galleryLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-20">
                  <LayoutGrid className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-lg text-muted-foreground font-korean">
                    {t('community.noGalleries')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {users.map((user) => (
                    <GalleryUserCard key={user.user_id} user={user} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Look Detail Modal */}
      {selectedLook && (
        <LookDetailModal
          look={selectedLook}
          onClose={() => setSelectedLook(null)}
          onPrevious={() => {
            if (selectedIndex > 0) {
              const prev = looks[selectedIndex - 1];
              handleLookClick(prev, selectedIndex - 1);
            }
          }}
          onNext={() => {
            if (selectedIndex < looks.length - 1) {
              const next = looks[selectedIndex + 1];
              handleLookClick(next, selectedIndex + 1);
            }
          }}
          hasPrevious={selectedIndex > 0}
          hasNext={selectedIndex < looks.length - 1}
          currentIndex={selectedIndex}
          totalCount={looks.length}
          onToggleLike={async (lookId, currentCount) => {
            const result = await toggleLike(lookId, currentCount);
            if (result) {
              updateLookLikeCount(lookId, result.newCount);
              setSelectedLook(prev => prev ? { ...prev, like_count: result.newCount } : null);
            }
            return result;
          }}
          isLiked={likedLookIds.has(selectedLook.id)}
        />
      )}
    </>
  );
};

export default Community;
