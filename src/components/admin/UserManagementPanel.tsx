/**
 * UserManagementPanel - 관리자용 사용자 관리 패널
 * 사용자 검색, 등급 확인, 역할 부여, 결제 알림 대기자 관리
 * 구매 기반 5단계 등급제 (Free, Bronze, Silver, Gold, Platinum)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TierBadge } from '@/components/ui/tier-badge';
import { useToast } from '@/hooks/use-toast';
import { Search, Users, Crown, Shield, User, RefreshCw, ChevronLeft, ChevronRight, Bell, Mail, Trash2, Copy, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { TierType, formatAmountKo } from '@/lib/tierConfig';

interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  current_tier: TierType;
  total_purchased_amount: number;
  total_purchases: number;
  role: string | null;
  gender: string | null;
  age_group: string | null;
}

interface PaymentNotifyRequest {
  id: string;
  email: string;
  requested_plan: string;
  reason: string;
  created_at: string;
  user_id: string;
}

const ITEMS_PER_PAGE = 20;

export const UserManagementPanel = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Payment notify requests
  const [notifyRequests, setNotifyRequests] = useState<PaymentNotifyRequest[]>([]);
  const [isNotifyLoading, setIsNotifyLoading] = useState(false);
  const [copiedEmails, setCopiedEmails] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      // Edge Function을 통해 auth.users 이메일 + 구매 통계 조회
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('인증이 필요합니다');
      }

      const response = await supabase.functions.invoke('admin-get-users', {
        body: {},
        headers: {},
      });

      if (response.error) {
        throw response.error;
      }

      const { users: fetchedUsers, total } = response.data;
      
      // Filter by search term client-side for now
      let filteredUsers = fetchedUsers as UserData[];
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredUsers = filteredUsers.filter((u: UserData) => 
          u.email.toLowerCase().includes(searchLower) ||
          (u.full_name && u.full_name.toLowerCase().includes(searchLower))
        );
      }

      // Paginate
      const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
      const paginatedUsers = filteredUsers.slice(startIdx, startIdx + ITEMS_PER_PAGE);

      setUsers(paginatedUsers);
      setTotalCount(filteredUsers.length);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: '사용자 목록 로드 실패',
        description: '관리자 권한이 필요합니다.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchTerm, toast]);

  const fetchNotifyRequests = useCallback(async () => {
    setIsNotifyLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_feedback')
        .select('*')
        .eq('action_type', 'payment_notify_request')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const requests: PaymentNotifyRequest[] = (data || []).map(item => {
        const context = item.context as Record<string, unknown> || {};
        return {
          id: item.id,
          email: String(context.email || ''),
          requested_plan: String(context.requested_plan || ''),
          reason: String(context.reason || ''),
          created_at: String(context.created_at || item.created_at || ''),
          user_id: item.user_id,
        };
      });

      setNotifyRequests(requests);
    } catch (error) {
      console.error('Error fetching notify requests:', error);
      toast({
        title: '알림 신청 목록 로드 실패',
        variant: 'destructive',
      });
    } finally {
      setIsNotifyLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
    fetchNotifyRequests();
  }, [fetchUsers, fetchNotifyRequests]);

  // 등급은 구매 기반으로 자동 결정되므로 플랜 변경 기능 제거
  // 역할(admin/moderator) 변경만 유지

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

  const handleDeleteNotifyRequest = async (id: string) => {
    try {
      const { error } = await supabase
        .from('product_feedback')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: '삭제 완료',
      });
      
      fetchNotifyRequests();
    } catch (error) {
      console.error('Error deleting notify request:', error);
      toast({
        title: '삭제 실패',
        variant: 'destructive',
      });
    }
  };

  const copyAllEmails = () => {
    const emails = notifyRequests.map(r => r.email).filter(Boolean).join(', ');
    navigator.clipboard.writeText(emails);
    setCopiedEmails(true);
    toast({
      title: '이메일 복사 완료',
      description: `${notifyRequests.length}개 이메일이 클립보드에 복사되었습니다.`,
    });
    setTimeout(() => setCopiedEmails(false), 2000);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // 등급 배지는 TierBadge 컴포넌트 사용

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

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      'daily-limit': '일일 생성 한도',
      'gallery-limit': '갤러리 한도',
      'hd-download': 'HD 다운로드',
      'family-profile': '가족 프로필',
      'family-limit': '프로필 한도',
      'recommend-first': '추천 우선',
    };
    return labels[reason] || reason;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <CardTitle className="font-korean">사용자 관리</CardTitle>
          </div>
        </div>
        <CardDescription className="font-korean">
          총 {totalCount}명의 사용자 | 결제 알림 대기: {notifyRequests.length}명
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              사용자 목록
            </TabsTrigger>
            <TabsTrigger value="notify" className="gap-2">
              <Bell className="w-4 h-4" />
              결제 대기자
              {notifyRequests.length > 0 && (
                <Badge variant="secondary" className="ml-1">{notifyRequests.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            {/* Search & Refresh */}
            <div className="flex gap-2">
              <div className="relative flex-1">
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
              <Button
                variant="outline"
                size="icon"
                onClick={fetchUsers}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
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
                    className="flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold font-korean truncate">
                          {user.full_name || '(이름 없음)'}
                        </span>
                        <TierBadge tier={user.current_tier} size="sm" />
                        {getRoleBadge(user.role)}
                      </div>
                      <div className="text-xs text-muted-foreground font-korean truncate">
                        {user.email}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-korean mt-0.5">
                        <span>가입: {format(new Date(user.created_at), 'yyyy.M.d', { locale: ko })}</span>
                        {user.total_purchases > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-primary font-medium">
                              {formatAmountKo(user.total_purchased_amount)} ({user.total_purchases}건)
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0">
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
          </TabsContent>

          {/* Payment Notify Tab */}
          <TabsContent value="notify" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-korean">
                결제 시스템 출시 시 알림을 받고 싶어하는 사용자 목록
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyAllEmails}
                  disabled={notifyRequests.length === 0}
                >
                  {copiedEmails ? (
                    <CheckCircle2 className="w-4 h-4 mr-1 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 mr-1" />
                  )}
                  전체 이메일 복사
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchNotifyRequests}
                  disabled={isNotifyLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${isNotifyLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {isNotifyLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))
            ) : notifyRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground font-korean">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>아직 결제 알림 신청자가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifyRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-amber-600" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{request.email}</span>
                        <Badge variant="outline">{request.requested_plan}</Badge>
                        <Badge variant="secondary" className="text-xs">
                          {getReasonLabel(request.reason)}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground font-korean">
                        신청: {format(new Date(request.created_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteNotifyRequest(request.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};