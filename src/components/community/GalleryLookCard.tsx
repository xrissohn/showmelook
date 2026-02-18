import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Globe, Lock } from 'lucide-react';
import { LazyImage } from '@/components/LazyImage';
import type { GalleryLook } from '@/hooks/useUserGallery';

interface GalleryLookCardProps {
  look: GalleryLook;
  isOwner: boolean;
  isLiked?: boolean;
  onToggleLike?: (lookId: string, currentCount: number) => void;
  onTogglePublic?: (lookId: string, currentPublic: boolean) => void;
}

const GalleryLookCard = ({
  look,
  isOwner,
  isLiked = false,
  onToggleLike,
  onTogglePublic,
}: GalleryLookCardProps) => {
  const navigate = useNavigate();
  const [animating, setAnimating] = useState(false);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleLike) return;
    setAnimating(true);
    onToggleLike(look.id, look.like_count);
    setTimeout(() => setAnimating(false), 300);
  };

  const handleTogglePublic = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePublic?.(look.id, look.is_public);
  };

  return (
    <div
      className={`group relative aspect-[3/4] rounded-2xl overflow-hidden bg-secondary cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
        !look.is_public && isOwner ? 'opacity-60' : ''
      }`}
      onClick={() => navigate(`/look/${look.id}`)}
    >
      <LazyImage
        src={look.image_url}
        alt="Gallery look"
        className="w-full h-full object-cover"
        fallbackClassName="w-full h-full"
      />

      {/* Bottom gradient */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />

      {/* Public/Private toggle (owner only) */}
      {isOwner && (
        <button
          onClick={handleTogglePublic}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/60"
          title={look.is_public ? '공개 중' : '비공개'}
        >
          {look.is_public ? (
            <Globe className="w-4 h-4 text-emerald-400" />
          ) : (
            <Lock className="w-4 h-4 text-amber-400" />
          )}
        </button>
      )}

      {/* Like button */}
      <button
        onClick={handleLike}
        className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 transition-colors hover:bg-black/60"
      >
        <Heart
          className={`w-4 h-4 transition-transform duration-300 ${
            isLiked ? 'fill-red-500 text-red-500' : 'text-white'
          } ${animating ? 'scale-125' : 'scale-100'}`}
        />
        <span className="text-white text-xs font-medium">
          {look.like_count > 0 ? look.like_count : ''}
        </span>
      </button>

      {/* Tags */}
      {look.tags && look.tags.length > 0 && (
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1 max-w-[60%]">
          {look.tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="text-[10px] sm:text-xs bg-black/50 text-white px-2 py-0.5 rounded-full backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default GalleryLookCard;
