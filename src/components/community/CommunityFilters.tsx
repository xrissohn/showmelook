import { Button } from '@/components/ui/button';
import { Flame, Clock } from 'lucide-react';
import type { SortOption } from '@/hooks/useCommunityFeed';

interface CommunityFiltersProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

const CommunityFilters = ({ sortBy, onSortChange }: CommunityFiltersProps) => {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={sortBy === 'popular' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSortChange('popular')}
        className="font-korean text-xs sm:text-sm rounded-full"
      >
        <Flame className="w-4 h-4 mr-1" />
        인기순
      </Button>
      <Button
        variant={sortBy === 'latest' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSortChange('latest')}
        className="font-korean text-xs sm:text-sm rounded-full"
      >
        <Clock className="w-4 h-4 mr-1" />
        최신순
      </Button>
    </div>
  );
};

export default CommunityFilters;
