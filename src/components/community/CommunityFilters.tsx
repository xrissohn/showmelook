import { Button } from '@/components/ui/button';
import { Flame, Clock } from 'lucide-react';
import type { SortOption } from '@/hooks/useCommunityFeed';
import { useLanguage } from '@/contexts/LanguageContext';

interface CommunityFiltersProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

const CommunityFilters = ({ sortBy, onSortChange }: CommunityFiltersProps) => {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={sortBy === 'popular' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSortChange('popular')}
        className="font-korean text-xs sm:text-sm rounded-full"
      >
        <Flame className="w-4 h-4 mr-1" />
        {t('community.popular')}
      </Button>
      <Button
        variant={sortBy === 'latest' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSortChange('latest')}
        className="font-korean text-xs sm:text-sm rounded-full"
      >
        <Clock className="w-4 h-4 mr-1" />
        {t('community.latest')}
      </Button>
    </div>
  );
};

export default CommunityFilters;
