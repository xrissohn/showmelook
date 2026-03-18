import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useUserGallery, type VisibilityFilter } from '@/hooks/useUserGallery';
import { useLookLikes } from '@/hooks/useLookLikes';
import GalleryLookCard from '@/components/community/GalleryLookCard';
import MainNavigation from '@/components/MainNavigation';
import { SEOHead } from '@/components/SEOHead';
import { LookDetailModal, LookDetailData } from '@/components/style/LookDetailModal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Images, Heart, Globe, Lock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const UserGallery = () => {
  const { t } = useLanguage();
  const { userId } = useParams<{ userId: string }>();
  const { data, isLoading, isOwner, filter, setFilter, filteredLooks, togglePublic, bulkToggle } = useUserGallery(userId);

  const lookIds = useMemo(() => filteredLooks.map((l) => l.id), [filteredLooks]);
  const { likedLookIds, toggleLike } = useLookLikes(lookIds);

  const [selectedLook, setSelectedLook] = useState<LookDetailData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const displayName = data?.profile.full_name || t('community.title');

  const handleToggleLike = async (lookId: string, currentCount: number) => {
    const result = await toggleLike(lookId, currentCount);
    if (result) {
      setSelectedLook(prev => prev?.id === lookId ? { ...prev, like_count: result.newCount } : prev);
    }
  };

  const handleLookClick = (look: typeof filteredLooks[0], index: number) => {
    setSelectedLook({
      ...look, is_favorite: false, is_public: look.is_public, user_id: userId || '',
      user_name: data?.profile.full_name || undefined, user_avatar: data?.profile.avatar_url || undefined,
    });
    setSelectedIndex(index);
  };

  if (isLoading) {
    return (
      <>
        <MainNavigation />
        <main className="min-h-screen bg-background pt-16 sm:pt-20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <MainNavigation />
        <main className="min-h-screen bg-background pt-16 sm:pt-20">
          <div className="container mx-auto px-4 py-20 text-center">
            <p className="text-muted-foreground font-korean">{t('community.noGalleries')}</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SEOHead custom={{ title: `${displayName} Gallery | ShowMeLook`, description: `${displayName}'s AI style gallery`, canonical: `https://showmelook.com/gallery/${userId}` }} />
      <MainNavigation />
      <main className="min-h-screen bg-background pt-16 sm:pt-20">
        <div className="container mx-auto px-3 sm:px-6 py-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="w-16 h-16 border-2 border-primary/20">
              <AvatarImage src={data.profile.avatar_url || undefined} alt={displayName} />
              <AvatarFallback className="text-lg bg-primary/10 text-primary">{displayName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-korean text-foreground">{displayName}</h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Images className="w-4 h-4" />{data.publicCount}</span>
                <span className="flex items-center gap-1"><Heart className="w-4 h-4" />{data.totalLikes}</span>
              </div>
            </div>
          </div>

          {isOwner && (
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as VisibilityFilter)}>
                <TabsList>
                  <TabsTrigger value="all" className="font-korean text-xs">{t('community.byPhoto')}</TabsTrigger>
                  <TabsTrigger value="public" className="font-korean text-xs">{t('community.popular')}</TabsTrigger>
                  <TabsTrigger value="private" className="font-korean text-xs">Private</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={() => bulkToggle(true)} className="font-korean text-xs rounded-full">
                  <Globe className="w-3.5 h-3.5 mr-1" />Public All
                </Button>
                <Button variant="outline" size="sm" onClick={() => bulkToggle(false)} className="font-korean text-xs rounded-full">
                  <Lock className="w-3.5 h-3.5 mr-1" />Private All
                </Button>
              </div>
            </div>
          )}

          {filteredLooks.length === 0 ? (
            <div className="text-center py-20">
              <Images className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-lg text-muted-foreground font-korean">
                {isOwner ? t('mypage.noHistory') : t('community.noPublicStyles')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {filteredLooks.map((look, index) => (
                <GalleryLookCard key={look.id} look={look} isOwner={isOwner} isLiked={likedLookIds.has(look.id)} onToggleLike={handleToggleLike} onTogglePublic={togglePublic} onClick={() => handleLookClick(look, index)} />
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedLook && (
        <LookDetailModal
          look={selectedLook}
          onClose={() => setSelectedLook(null)}
          onPrevious={() => { if (selectedIndex > 0) handleLookClick(filteredLooks[selectedIndex - 1], selectedIndex - 1); }}
          onNext={() => { if (selectedIndex < filteredLooks.length - 1) handleLookClick(filteredLooks[selectedIndex + 1], selectedIndex + 1); }}
          hasPrevious={selectedIndex > 0}
          hasNext={selectedIndex < filteredLooks.length - 1}
          currentIndex={selectedIndex}
          totalCount={filteredLooks.length}
          onToggleLike={async (lookId, currentCount) => {
            const result = await toggleLike(lookId, currentCount);
            if (result) setSelectedLook(prev => prev ? { ...prev, like_count: result.newCount } : null);
            return result;
          }}
          isLiked={likedLookIds.has(selectedLook.id)}
        />
      )}
    </>
  );
};

export default UserGallery;
