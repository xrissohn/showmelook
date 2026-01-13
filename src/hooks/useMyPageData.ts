import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface RecommendationItem {
  category: string;
  name: string;
  price: number;
  image_url: string;
  product_url: string;
  brand?: string;
}

interface RecommendationHistory {
  id: string;
  prompt: string;
  gender: string;
  budget: number;
  style_concept: string;
  style_reasoning: string;
  items: RecommendationItem[];
  total_price: number;
  created_at: string;
}

interface LikedProduct {
  id: string;
  product_id: string;
  product_name: string;
  product_brand: string | null;
  product_price: number;
  product_image_url: string | null;
  product_url: string;
  product_category: string | null;
  style_tags: string[] | null;
  created_at: string;
}

const STALE_TIME = 5 * 60 * 1000; // 5분 캐시

// 추천 히스토리 조회
export function useRecommendationHistory() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recommendationHistory', user?.id],
    queryFn: async (): Promise<RecommendationHistory[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('recommendation_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((rec: any) => ({
        ...rec,
        items: typeof rec.items === 'string' ? JSON.parse(rec.items) : rec.items
      }));
    },
    enabled: !!user,
    staleTime: STALE_TIME,
    gcTime: STALE_TIME * 2, // 가비지 컬렉션 시간
  });
}

// 좋아요 상품 조회
export function useLikedProducts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['likedProducts', user?.id],
    queryFn: async (): Promise<LikedProduct[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('liked_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: STALE_TIME,
    gcTime: STALE_TIME * 2,
  });
}

// 추천 히스토리 삭제
export function useDeleteRecommendation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recommendation_history')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      // 캐시에서 직접 제거 (네트워크 요청 없이)
      queryClient.setQueryData(
        ['recommendationHistory', user?.id],
        (old: RecommendationHistory[] | undefined) => 
          old?.filter(rec => rec.id !== deletedId) || []
      );
    },
  });
}

// 좋아요 취소
export function useUnlikeProduct() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('liked_products')
        .delete()
        .eq('id', productId);

      if (error) throw error;
      return productId;
    },
    onSuccess: (deletedId) => {
      // 캐시에서 직접 제거
      queryClient.setQueryData(
        ['likedProducts', user?.id],
        (old: LikedProduct[] | undefined) => 
          old?.filter(product => product.id !== deletedId) || []
      );
    },
  });
}

// 장바구니 추가
export function useAddToCart() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (product: LikedProduct) => {
      if (!user) throw new Error('로그인이 필요합니다');

      const { error } = await supabase.from('cart_items').upsert({
        user_id: user.id,
        product_id: product.product_id,
        quantity: 1,
        product_source: 'cache',
        product_name: product.product_name,
        product_brand: product.product_brand,
        product_price: product.product_price,
        product_image_url: product.product_image_url,
        product_url: product.product_url,
      }, {
        onConflict: 'user_id,product_id'
      });

      if (error) throw error;
      return product;
    },
  });
}
