import { useNavigate } from 'react-router-dom';
import { Heart, Images } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LazyImage } from '@/components/LazyImage';
import type { GalleryUser } from '@/hooks/useGalleryUsers';

interface GalleryUserCardProps {
  user: GalleryUser;
}

const GalleryUserCard = ({ user }: GalleryUserCardProps) => {
  const navigate = useNavigate();
  const displayName = user.full_name || 'Stylist';

  return (
    <div
      className="group rounded-2xl overflow-hidden bg-card border border-border cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.01]"
      onClick={() => navigate(`/gallery/${user.user_id}`)}
    >
      <div className="grid grid-cols-2 gap-0.5 aspect-[4/3]">
        {user.preview_images.slice(0, 4).map((img, i) => (
          <div key={i} className="relative overflow-hidden bg-secondary">
            <LazyImage src={img} alt={`${displayName}'s look`} className="w-full h-full object-cover" fallbackClassName="w-full h-full" />
          </div>
        ))}
        {Array.from({ length: Math.max(0, 4 - user.preview_images.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-secondary/50" />
        ))}
      </div>

      <div className="p-3 flex items-center gap-3">
        <Avatar className="w-9 h-9 border-2 border-primary/20">
          <AvatarImage src={user.avatar_url || undefined} alt={displayName} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">{displayName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate font-korean">{displayName}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Images className="w-3 h-3" />{user.public_look_count}</span>
            <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{user.total_likes}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GalleryUserCard;
