/**
 * UserManagementPanel - 관리자용 사용자 관리 패널
 * 사용자 검색, 플랜 변경, 역할 부여
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Search, Users, Crown, Shield, User, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  plan: string;
  role: string | null;
  daily_limit: number;
}

const ITEMS_PER_PAGE = 20;

export const UserManagementPanel = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      // 프로필 + 구독 정보 조인
      let query = supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          full_name,
          created_at
        `, { count: 'exact' });

      if (searchTerm) {
        query = query.ilike('full_name', `%${searchTerm}%`);
      }

      const { data: profiles, count, error } = await query
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      if (error) throw error;

      // 사용자별 구독/역할 정보 조회
      const userIds = profiles?.map(p => p.user_id) || [];
      
      const [subsResult, rolesResult] = await Promise.all([
        supabase.from('user_subscriptions').select('*').in('user_id', userIds),
        supabase.from('user_roles').select('*').in('user_id', userIds),
      ]);

      const subsMap = new Map(subsResult.data?.map(s => [s.user_id, s]) || []);
      const rolesMap = new Map(rolesResult.data?.map(r => [r.user_id, r]) || []);

      const usersData: UserData[] = profiles?.map(p => ({
        id: p.user_id,
        email: '', // 이메일은 auth.users에서 가져올 수 없음
        full_name: p.full_name,
        created_at: p.created_at,
        plan: subsMap.get(p.user_id)?.plan || 'free',
        role: rolesMap.get(p.user_id)?.role || null,
        daily_limit: subsMap.get(p.user_id)?.daily_limit || 5,
      })) || [];

      setUsers(usersData);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: '사용자 목록 로드 실패',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchTerm, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handlePlanChange = async (userId: string, newPlan: string) => {
    try {
      // 구독 정보 업데이트 또는 생성
      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          plan: newPlan,
          daily_limit: newPlan === 'free' ? 5 : newPlan === 'pro' ? 20 : -1,
          gallery_limit: newPlan === 'free' ? 10 : newPlan === 'pro' ? 50 : -1,
          max_profiles: newPlan === 'premium' ? 6 : 1,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast({
        title: '플랜 변경 완료',
        description: `${newPlan} 플랜으로 변경되었습니다.`,
      });
      
      fetchUsers();
    } catch (error) {
      console.error('Error changing plan:', error);
      toast({
        title: '플랜 변경 실패',
        variant: 'destructive',
      });
    }
  };

  const handleRoleChange = async (userId: string, newRole: string | null) => {
    try {
      if (newRole === 'user' || !newRole) {
        // 역할 삭제
        await supabase.from('user_roles').delete().eq('user_id', userId);
      } else {
        // 기존 역할 삭제 후 새 역할 추가
        await supabase.from('user_roles').delete().eq('user_id', userId);
        await supabase.from('user_roles').insert({
          user_id: userId,
          role: newRole as 'admin' | 'moderator' | 'user',
        });
      }

      toast({
        title: '역할 변경 완료',
        description: newRole ? `${newRole} 역할이 부여되었습니다.` : '역할이 해제되었습니다.',
      });
      
      fetchUsers();
    } catch (error) {
      console.error('Error changing role:', error);
      toast({
        title: '역할 변경 실패',
        variant: 'destructive',
      });
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'premium':
        return <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white">Premium</Badge>;
      case 'pro':
        return <Badge className="bg-gradient-to-r from-primary to-accent text-white">Pro</Badge>;
      default:
        return <Badge variant="secondary">Free</Badge>;
    }
  };

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive" className="gap-1"><Shield className="w-3 h-3" /> Admin</Badge>;
      case 'moderator':
        return <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600"><Crown className="w-3 h-3" /> Mod</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <CardTitle className="font-korean">사용자 관리</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsers}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
        <CardDescription className="font-korean">
          총 {totalCount}명의 사용자
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="이름으로 검색..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>

        {/* User List */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-korean">
              사용자가 없습니다
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold font-korean truncate">
                      {user.full_name || '(이름 없음)'}
                    </span>
                    {getPlanBadge(user.plan)}
                    {getRoleBadge(user.role)}
                  </div>
                  <div className="text-sm text-muted-foreground font-korean">
                    가입: {format(new Date(user.created_at), 'yyyy년 M월 d일', { locale: ko })}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Select
                    value={user.plan}
                    onValueChange={(value) => handlePlanChange(user.id, value)}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select
                    value={user.role || 'user'}
                    onValueChange={(value) => handleRoleChange(user.id, value === 'user' ? null : value)}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => p - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
