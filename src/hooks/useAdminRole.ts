/**
 * useAdminRole - 관리자 역할 확인 훅
 * user_roles 테이블에서 admin 역할 확인
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminRoleState {
  isAdmin: boolean;
  isModerator: boolean;
  isLoading: boolean;
}

export const useAdminRole = (userId: string | undefined) => {
  const [state, setState] = useState<AdminRoleState>({
    isAdmin: false,
    isModerator: false,
    isLoading: true,
  });

  const checkRole = useCallback(async () => {
    if (!userId) {
      setState({ isAdmin: false, isModerator: false, isLoading: false });
      return;
    }

    try {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('Error checking roles:', error);
        setState({ isAdmin: false, isModerator: false, isLoading: false });
        return;
      }

      const roleList = roles?.map(r => r.role) || [];
      
      setState({
        isAdmin: roleList.includes('admin'),
        isModerator: roleList.includes('moderator') || roleList.includes('admin'),
        isLoading: false,
      });
    } catch (error) {
      console.error('Error in useAdminRole:', error);
      setState({ isAdmin: false, isModerator: false, isLoading: false });
    }
  }, [userId]);

  useEffect(() => {
    checkRole();
  }, [checkRole]);

  return { ...state, refetch: checkRole };
};
