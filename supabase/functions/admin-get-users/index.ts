/**
 * admin-get-users Edge Function
 * 관리자 전용: auth.users에서 이메일 정보를 포함한 사용자 목록 조회
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // User client to verify admin role
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse query params
    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';

    // Get ALL auth users via admin API by paginating through all pages
    const allUsers: Array<{
      id: string;
      email?: string;
      created_at: string;
    }> = [];
    
    let currentPage = 1;
    const perPage = 50; // Max per page for efficiency
    let hasMore = true;
    
    while (hasMore) {
      const { data: authData, error: listError } = await adminClient.auth.admin.listUsers({
        page: currentPage,
        perPage: perPage,
      });

      if (listError) {
        throw listError;
      }

      if (authData.users && authData.users.length > 0) {
        allUsers.push(...authData.users.map(u => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
        })));
        
        // Check if there are more pages
        if (authData.users.length < perPage) {
          hasMore = false;
        } else {
          currentPage++;
        }
      } else {
        hasMore = false;
      }
    }

    const userIds = allUsers.map(u => u.id);

    // Fetch profiles, purchase stats, and roles in parallel
    const [profilesResult, statsResult, rolesResult] = await Promise.all([
      adminClient.from('profiles').select('*').in('user_id', userIds),
      adminClient.from('user_purchase_stats').select('*').in('user_id', userIds),
      adminClient.from('user_roles').select('*').in('user_id', userIds),
    ]);

    const profilesMap = new Map(profilesResult.data?.map(p => [p.user_id, p]) || []);
    const statsMap = new Map(statsResult.data?.map(s => [s.user_id, s]) || []);
    const rolesMap = new Map(rolesResult.data?.map(r => [r.user_id, r]) || []);

    // Combine data
    let users = allUsers.map(authUser => {
      const profile = profilesMap.get(authUser.id);
      const stats = statsMap.get(authUser.id);
      const role = rolesMap.get(authUser.id);

      return {
        id: authUser.id,
        email: authUser.email || '',
        full_name: profile?.full_name || null,
        created_at: authUser.created_at,
        current_tier: stats?.current_tier || 'free',
        total_purchased_amount: stats?.total_purchased_amount || 0,
        total_purchases: stats?.total_purchases || 0,
        role: role?.role || null,
        gender: profile?.gender || null,
        age_group: profile?.age_group || null,
      };
    });

    // Filter by search term if provided
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(u => 
        u.email.toLowerCase().includes(searchLower) ||
        (u.full_name && u.full_name.toLowerCase().includes(searchLower))
      );
    }

    // Sort by created_at desc
    users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return new Response(JSON.stringify({
      users,
      total: allUsers.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
