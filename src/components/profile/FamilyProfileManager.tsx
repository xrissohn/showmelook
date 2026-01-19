/**
 * FamilyProfileManager - 가족 프로필 관리 UI
 * Premium 전용: 최대 5명 추가 가능
 */

import { useState } from 'react';
import { useFamilyProfiles, FamilyProfileInput } from '@/hooks/useFamilyProfiles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Users, Pencil, Trash2, User, Heart, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FamilyProfileManagerProps {
  userId: string;
  maxProfiles?: number;
}

const relationships = [
  { value: '가족', label: '가족', emoji: '👨‍👩‍👧' },
  { value: '애인', label: '애인', emoji: '💑' },
  { value: '친구', label: '친구', emoji: '👫' },
  { value: '부모님', label: '부모님', emoji: '👴' },
  { value: '자녀', label: '자녀', emoji: '👶' },
  { value: '형제자매', label: '형제자매', emoji: '👯' },
];

const genders = [
  { value: '남성', label: '남성' },
  { value: '여성', label: '여성' },
];

const bodyTypes = [
  { value: 'slim', label: '마른 체형' },
  { value: 'average', label: '보통 체형' },
  { value: 'muscular', label: '근육질' },
  { value: 'curvy', label: '볼륨 체형' },
];

export const FamilyProfileManager = ({ userId, maxProfiles = 5 }: FamilyProfileManagerProps) => {
  const { profiles, isLoading, canAddMore, currentCount, addProfile, updateProfile, deleteProfile } = useFamilyProfiles(userId, maxProfiles);
  const { toast } = useToast();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [formData, setFormData] = useState<FamilyProfileInput>({
    full_name: '',
    relationship: '',
    gender: '',
    height: undefined,
    weight: undefined,
    body_type: '',
  });

  const resetForm = () => {
    setFormData({
      full_name: '',
      relationship: '',
      gender: '',
      height: undefined,
      weight: undefined,
      body_type: '',
    });
  };

  const handleAdd = async () => {
    if (!formData.full_name.trim()) {
      toast({
        title: '이름을 입력해주세요',
        variant: 'destructive',
      });
      return;
    }

    const success = await addProfile(formData);
    if (success) {
      setIsAddDialogOpen(false);
      resetForm();
    }
  };

  const handleUpdate = async (profileId: string) => {
    const success = await updateProfile(profileId, formData);
    if (success) {
      setEditingProfile(null);
      resetForm();
    }
  };

  const handleDelete = async (profileId: string) => {
    if (!confirm('정말 삭제하시겠어요?')) return;
    await deleteProfile(profileId);
  };

  const openEditDialog = (profile: typeof profiles[0]) => {
    setFormData({
      full_name: profile.full_name,
      relationship: profile.relationship || '',
      gender: profile.gender || '',
      height: profile.height || undefined,
      weight: profile.weight || undefined,
      body_type: profile.body_type || '',
    });
    setEditingProfile(profile.id);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <CardTitle className="font-korean">가족 프로필</CardTitle>
          </div>
          <Badge variant="secondary">
            {currentCount}/{maxProfiles}명
          </Badge>
        </div>
        <CardDescription className="font-korean">
          소중한 사람의 스타일도 함께 만들어보세요
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Profile List */}
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border"
          >
            <Avatar className="w-12 h-12">
              <AvatarImage src={profile.avatar_url || ''} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                {profile.full_name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold font-korean">{profile.full_name}</span>
                {profile.relationship && (
                  <Badge variant="outline" className="text-xs">
                    {relationships.find(r => r.value === profile.relationship)?.emoji} {profile.relationship}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground font-korean">
                {profile.gender && <span>{profile.gender}</span>}
                {profile.height && <span> · {profile.height}cm</span>}
                {profile.weight && <span> · {profile.weight}kg</span>}
              </div>
            </div>
            
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditDialog(profile)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(profile.id)}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {profiles.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-korean">아직 추가된 가족 프로필이 없어요</p>
            <p className="text-sm font-korean">소중한 사람의 스타일도 만들어보세요!</p>
          </div>
        )}

        {/* Add Button */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full font-korean"
              disabled={!canAddMore}
            >
              <Plus className="w-4 h-4 mr-2" />
              {canAddMore ? '프로필 추가하기' : `최대 ${maxProfiles}명까지 추가 가능`}
            </Button>
          </DialogTrigger>
          
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-korean">가족 프로필 추가</DialogTitle>
              <DialogDescription className="font-korean">
                소중한 사람의 정보를 입력해주세요
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div>
                <Label className="font-korean">이름 *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="이름을 입력하세요"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label className="font-korean">관계</Label>
                <Select
                  value={formData.relationship}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, relationship: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="관계 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {relationships.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.emoji} {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="font-korean">성별</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="성별 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {genders.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-korean">키 (cm)</Label>
                  <Input
                    type="number"
                    value={formData.height || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value ? parseInt(e.target.value) : undefined }))}
                    placeholder="170"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="font-korean">몸무게 (kg)</Label>
                  <Input
                    type="number"
                    value={formData.weight || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value ? parseInt(e.target.value) : undefined }))}
                    placeholder="65"
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div>
                <Label className="font-korean">체형</Label>
                <Select
                  value={formData.body_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, body_type: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="체형 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {bodyTypes.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 font-korean"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    resetForm();
                  }}
                >
                  취소
                </Button>
                <Button
                  variant="hero"
                  className="flex-1 font-korean"
                  onClick={handleAdd}
                >
                  추가하기
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingProfile} onOpenChange={(open) => !open && setEditingProfile(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-korean">프로필 수정</DialogTitle>
              <DialogDescription className="font-korean">
                프로필 정보를 수정해주세요
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div>
                <Label className="font-korean">이름 *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="이름을 입력하세요"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label className="font-korean">관계</Label>
                <Select
                  value={formData.relationship}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, relationship: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="관계 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {relationships.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.emoji} {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="font-korean">성별</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="성별 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {genders.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-korean">키 (cm)</Label>
                  <Input
                    type="number"
                    value={formData.height || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value ? parseInt(e.target.value) : undefined }))}
                    placeholder="170"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="font-korean">몸무게 (kg)</Label>
                  <Input
                    type="number"
                    value={formData.weight || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value ? parseInt(e.target.value) : undefined }))}
                    placeholder="65"
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div>
                <Label className="font-korean">체형</Label>
                <Select
                  value={formData.body_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, body_type: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="체형 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {bodyTypes.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 font-korean"
                  onClick={() => {
                    setEditingProfile(null);
                    resetForm();
                  }}
                >
                  취소
                </Button>
                <Button
                  variant="hero"
                  className="flex-1 font-korean"
                  onClick={() => editingProfile && handleUpdate(editingProfile)}
                >
                  저장하기
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
