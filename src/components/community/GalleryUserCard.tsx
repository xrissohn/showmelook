import { useNavigate } from 'react-router-dom';
import { Heart, Images } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LazyImage } from '@/components/LazyImage';
import type { GalleryUser } from '@/hooks/useGalleryUsers';

interface GalleryUserCardProps {
  user: GalleryUser;
  /** 첫 화면에 보이는 카드: 미리보기 이미지를 바로 불러온다 */
  priority?: boolean;
}

const GalleryUserCard = ({ user, priority = false }: GalleryUserCardProps) => {
  const navigate = useNavigate();
  const displayName = user.full_name || 'Stylist';
  const previews = Array.from(new Set(user.preview_images)).slice(0, 4);

  return (
    <div
      className="group rounded-2xl overflow-hidden bg-card border border-border cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.01]"
      onClick={() => navigate(`/gallery/${user.user_id}`)}
    >
      {previews.length === 0 ? (
        <div className="aspect-[3/4] bg-secondary/50 flex items-center justify-center"><Images className="h-8 w-8 text-muted-foreground" /></div>
      ) : (
        <div className={`grid gap-0.5 ${previews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {Array.from({ length: previews.length === 1 ? 1 : 2 }, (_, column) => (
            <div key={column} className="flex min-w-0 flex-col gap-0.5">
              {previews.filter((_, index) => previews.length === 1 || index % 2 === column).map(img => (
                <LazyImage key={img} src={img} alt={`${displayName}'s look`} className="w-full object-contain" naturalAspect width={320} priority={priority} />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="p-2 sm:p-3 flex items-center gap-2">
        <Avatar className="hidden sm:flex w-7 h-7 border-2 border-primary/20">
          <AvatarImage src={user.avatar_url || undefined} alt={displayName} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">{displayName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate font-korean">{displayName}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Images className="w-3 h-3" />{user.public_look_count}</span>
            <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{user.total_likes}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GalleryUserCard;
