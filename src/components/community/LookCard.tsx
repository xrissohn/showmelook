import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { LazyImage } from '@/components/LazyImage';
import type { CommunityLook } from '@/hooks/useCommunityFeed';

interface LookCardProps {
  look: CommunityLook;
  isLiked: boolean;
  onToggleLike: (lookId: string, currentCount: number) => void;
}

const LookCard = ({ look, isLiked, onToggleLike }: LookCardProps) => {
  const navigate = useNavigate();
  const [animating, setAnimating] = useState(false);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAnimating(true);
    onToggleLike(look.id, look.like_count);
    setTimeout(() => setAnimating(false), 300);
  };

  return (
    <div
      className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-secondary cursor-pointer transition-transform duration-200 hover:scale-[1.02]"
      onClick={() => navigate(`/look/${look.id}`)}
    >
      <LazyImage
        src={look.image_url}
        alt="Community look"
        className="w-full h-full object-cover"
        fallbackClassName="w-full h-full"
      />

      {/* Bottom gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />

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

      {/* Caption on hover */}
      {look.caption && (
        <div className="absolute inset-x-0 bottom-0 p-3 pb-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-white text-xs font-korean line-clamp-2">{look.caption}</p>
        </div>
      )}
    </div>
  );
};

export default LookCard;
