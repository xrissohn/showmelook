import { useMemo, useState } from 'react';
import { Images, Loader2, Plus, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TierBadge } from '@/components/ui/tier-badge';
import { useAuth } from '@/hooks/useAuth';
import { useGeneratedLooks } from '@/hooks/useGeneratedLooks';
import { usePurchaseStats } from '@/hooks/usePurchaseStats';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { claimGalleryPublicCredit, GALLERY_PUBLIC_CREDIT_TEXT } from '@/lib/galleryReward';

interface CommunityPostComposerProps {
  onPublished: () => void;
}

export function CommunityPostComposer({ onPublished }: CommunityPostComposerProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { looks, isLoading, refetch } = useGeneratedLooks();
  const { stats } = usePurchaseStats(user?.id);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [tagText, setTagText] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const selectedLook = useMemo(() => looks.find((look) => look.id === selectedId), [looks, selectedId]);
  const copy = language === 'en' ? {
    button: 'Create post', title: 'Share a generated look', description: 'Choose one of your AI looks and add a short story.',
    empty: 'Create a look first, then share it here.', create: 'Create a look', caption: 'Post description',
    captionPlaceholder: 'What do you like about this outfit?', tags: 'Tags', tagsPlaceholder: 'daily, office, spring',
    submit: 'Publish', publishing: 'Publishing…', success: 'Your look is now public.', choose: 'Select a look', tier: 'My tier',
  } : {
    button: '게시하기', title: '생성한 룩 공개하기', description: '내가 만든 AI 룩을 고르고 짧은 소개를 더해보세요.',
    empty: '먼저 스타일을 생성한 뒤 이곳에 공개할 수 있어요.', create: '스타일 만들기', caption: '게시물 소개',
    captionPlaceholder: '이 코디의 마음에 드는 점을 알려주세요.', tags: '태그', tagsPlaceholder: '데일리, 출근룩, 봄',
    submit: '커뮤니티에 공개', publishing: '공개 중…', success: '스타일 갤러리에 게시되었습니다.', choose: '공개할 룩 선택', tier: '내 등급',
  };

  const handleOpen = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    setOpen(true);
  };

  const handleSelect = (look: typeof looks[number]) => {
    setSelectedId(look.id);
    setCaption(look.caption || look.memo || '');
    setTagText((look.tags || []).join(', '));
  };

  const handlePublish = async () => {
    if (!selectedLook) return;
    setIsPublishing(true);
    const tags = tagText.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean).slice(0, 5);
    const cleanCaption = caption.trim().slice(0, 200);
    const { error } = await supabase
      .from('generated_looks')
      .update({ is_public: true, caption: cleanCaption || null, memo: cleanCaption || null, tags: tags.length ? tags : null })
      .eq('id', selectedLook.id);

    if (error) {
      toast({ title: language === 'en' ? 'Could not publish' : '게시하지 못했습니다', description: error.message, variant: 'destructive' });
      setIsPublishing(false);
      return;
    }

    if (!selectedLook.is_public) await claimGalleryPublicCredit(selectedLook.id);
    await refetch();
    onPublished();
    setOpen(false);
    setSelectedId(null);
    setCaption('');
    setTagText('');
    setIsPublishing(false);
    toast({ title: copy.success });
  };

  return (
    <>
      <Button onClick={handleOpen} className="shrink-0 font-korean">
        <Plus className="mr-1.5 h-4 w-4" />{copy.button}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-korean">{copy.title}</DialogTitle>
          <DialogDescription className="font-korean">{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b border-border pb-3 text-sm text-muted-foreground">
          <span className="font-korean">{copy.tier}</span>
          <TierBadge tier={stats?.currentTier || 'free'} size="sm" />
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : looks.length === 0 ? (
          <div className="py-10 text-center">
            <Images className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="mb-4 font-korean text-sm text-muted-foreground">{copy.empty}</p>
            <Button variant="outline" onClick={() => navigate('/style')}><Sparkles className="mr-2 h-4 w-4" />{copy.create}</Button>
          </div>
        ) : (
          <>
            <div>
              <p className="mb-2 font-korean text-sm font-medium">{copy.choose}</p>
              <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                {looks.map((look) => (
                  <Button
                    key={look.id}
                    type="button"
                    variant="ghost"
                    onClick={() => handleSelect(look)}
                    aria-pressed={selectedId === look.id}
                    className={`h-auto overflow-hidden rounded-md p-0 ring-offset-background ${selectedId === look.id ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  >
                    <img src={look.image_url} alt="" className="aspect-[3/4] w-full object-cover" />
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="community-caption" className="font-korean text-sm font-medium">{copy.caption}</label>
              <Textarea id="community-caption" value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={200} placeholder={copy.captionPlaceholder} className="min-h-20 resize-none font-korean" />
              <p className="text-right text-xs text-muted-foreground">{caption.length}/200</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="community-tags" className="font-korean text-sm font-medium">{copy.tags}</label>
              <Input id="community-tags" value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder={copy.tagsPlaceholder} />
              <p className="font-korean text-xs text-muted-foreground">{GALLERY_PUBLIC_CREDIT_TEXT}</p>
            </div>
            <Button onClick={handlePublish} disabled={!selectedLook || isPublishing} className="w-full font-korean">
              {isPublishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isPublishing ? copy.publishing : copy.submit}
            </Button>
          </>
        )}
        </DialogContent>
      </Dialog>
    </>
  );
}