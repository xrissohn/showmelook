import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 관리자 인증 필수
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const token = authHeader.replace('Bearer ', '');
    let callerId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser(token);
      callerId = userData?.user?.id || null;
      if (!callerId) {
        const { data: claimsData } = await supabase.auth.getClaims(token);
        callerId = (claimsData?.claims?.sub as string) || null;
      }
    } catch (_e) {
      callerId = null;
    }
    if (!callerId) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'admin')
      .maybeSingle();
    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, mall_id, product_no } = await req.json();

    if (!mall_id) {
      return new Response(
        JSON.stringify({ error: 'mall_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // 테넌트 조회 및 토큰 검증
    const { data: tenant, error: tenantError } = await supabase
      .from('cafe24_tenants')
      .select('*')
      .eq('mall_id', mall_id)
      .eq('is_active', true)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 토큰 만료 체크 및 갱신
    const tokenExpired = new Date(tenant.expires_at) < new Date();
    if (tokenExpired) {
      // 토큰 갱신 요청
      const refreshUrl = `${SUPABASE_URL}/functions/v1/cafe24-oauth/refresh?mall_id=${mall_id}`;
      const refreshResponse = await fetch(refreshUrl);
      
      if (!refreshResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Token expired and refresh failed' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 갱신된 토큰 다시 조회
      const { data: refreshedTenant } = await supabase
        .from('cafe24_tenants')
        .select('access_token')
        .eq('mall_id', mall_id)
        .single();
      
      if (refreshedTenant) {
        tenant.access_token = refreshedTenant.access_token;
      }
    }

    const apiBaseUrl = `https://${mall_id}.cafe24api.com/api/v2`;
    const headers = {
      'Authorization': `Bearer ${tenant.access_token}`,
      'Content-Type': 'application/json',
      'X-Cafe24-Api-Version': '2024-06-01',
    };

    // ==========================================
    // 액션별 처리
    // ==========================================
    switch (action) {
      // 상품 목록 조회
      case 'list-products': {
        const limit = 100;
        let offset = 0;
        let allProducts: any[] = [];

        while (true) {
          const response = await fetch(
            `${apiBaseUrl}/admin/products?limit=${limit}&offset=${offset}`,
            { headers }
          );

          if (!response.ok) {
            const error = await response.json();
            return new Response(
              JSON.stringify({ error: 'Failed to fetch products', details: error }),
              { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const data = await response.json();
          const products = data.products || [];
          allProducts = allProducts.concat(products);

          if (products.length < limit) break;
          offset += limit;

          // Rate limit 방지
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // DB에 상품 동기화 + products_cache 연동
        let linkedCount = 0;
        
        for (const product of allProducts) {
          // 1. cafe24_products에 저장
          const { data: cafe24Product } = await supabase
            .from('cafe24_products')
            .upsert({
              tenant_id: tenant.id,
              cafe24_product_no: product.product_no,
              product_name: product.product_name,
              product_code: product.product_code,
              price: parseInt(product.price) || 0,
              image_url: product.detail_image || product.list_image,
              category_name: product.category?.name_1,
              is_synced: true,
              last_synced_at: new Date().toISOString(),
            }, { onConflict: 'tenant_id,cafe24_product_no' })
            .select('id, products_cache_id')
            .single();

          // 2. products_cache에 없으면 자동 등록
          if (cafe24Product && !cafe24Product.products_cache_id) {
            // 상품 URL 생성
            const productUrl = `https://${mall_id}.cafe24.com/product/${product.product_code}`;
            
            // 카테고리 매핑
            const categoryName = product.category?.name_1?.toLowerCase() || '';
            let category = 'others';
            if (categoryName.includes('상의') || categoryName.includes('top')) category = 'top';
            else if (categoryName.includes('하의') || categoryName.includes('bottom') || categoryName.includes('pants')) category = 'bottom';
            else if (categoryName.includes('원피스') || categoryName.includes('dress')) category = 'dress';
            else if (categoryName.includes('아우터') || categoryName.includes('outer') || categoryName.includes('jacket')) category = 'outerwear';
            else if (categoryName.includes('신발') || categoryName.includes('shoes')) category = 'shoes';
            else if (categoryName.includes('가방') || categoryName.includes('bag')) category = 'bag';
            else if (categoryName.includes('액세서리') || categoryName.includes('accessory')) category = 'accessory';

            // products_cache에 등록
            const { data: cacheProduct } = await supabase
              .from('products_cache')
              .insert({
                merchant_id: 'cafe24_' + mall_id,
                name: product.product_name,
                brand: product.brand?.name || null,
                price: parseInt(product.price) || 0,
                original_price: parseInt(product.retail_price) || null,
                image_url: product.detail_image || product.list_image,
                product_url: productUrl,
                category: category,
                gender: 'unisex',
                is_active: true,
                is_in_stock: product.display === 'T' && product.selling === 'T',
              })
              .select('id')
              .single();

            // cafe24_products에 캐시 ID 연결
            if (cacheProduct) {
              await supabase
                .from('cafe24_products')
                .update({ products_cache_id: cacheProduct.id })
                .eq('id', cafe24Product.id);
              linkedCount++;
            }
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            synced_count: allProducts.length,
            linked_to_cache: linkedCount,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 단일 상품 조회
      case 'get-product': {
        if (!product_no) {
          return new Response(
            JSON.stringify({ error: 'product_no is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(
          `${apiBaseUrl}/admin/products/${product_no}`,
          { headers }
        );

        if (!response.ok) {
          const error = await response.json();
          return new Response(
            JSON.stringify({ error: 'Failed to fetch product', details: error }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({ success: true, product: data.product }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 카테고리 목록 조회
      case 'list-categories': {
        const response = await fetch(
          `${apiBaseUrl}/admin/categories`,
          { headers }
        );

        if (!response.ok) {
          const error = await response.json();
          return new Response(
            JSON.stringify({ error: 'Failed to fetch categories', details: error }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({ success: true, categories: data.categories }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 쇼핑몰 정보 조회
      case 'get-store-info': {
        const response = await fetch(
          `${apiBaseUrl}/admin/store`,
          { headers }
        );

        if (!response.ok) {
          const error = await response.json();
          return new Response(
            JSON.stringify({ error: 'Failed to fetch store info', details: error }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();

        // 쇼핑몰 이름 저장
        if (data.store?.shop_name) {
          await supabase
            .from('cafe24_tenants')
            .update({ shop_name: data.store.shop_name })
            .eq('mall_id', mall_id);
        }

        return new Response(
          JSON.stringify({ success: true, store: data.store }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 웹훅 등록
      case 'register-webhooks': {
        const webhookUrl = `${SUPABASE_URL}/functions/v1/cafe24-oauth/webhook`;
        
        const webhookEvents = [
          'app/uninstalled',
          'product/created',
          'product/updated',
          'product/deleted',
        ];

        const results = [];

        for (const event of webhookEvents) {
          const response = await fetch(
            `${apiBaseUrl}/admin/webhooks`,
            {
              method: 'POST',
              headers,
              body: JSON.stringify({
                webhook: {
                  event: event,
                  url: webhookUrl,
                }
              }),
            }
          );

          const data = await response.json();
          results.push({ event, success: response.ok, data });

          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // 웹훅 URL 저장
        await supabase
          .from('cafe24_tenants')
          .update({ webhook_url: webhookUrl })
          .eq('mall_id', mall_id);

        return new Response(
          JSON.stringify({ success: true, results }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ 
            error: 'Unknown action',
            available_actions: [
              'list-products',
              'get-product',
              'list-categories', 
              'get-store-info',
              'register-webhooks'
            ]
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Cafe24 sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
