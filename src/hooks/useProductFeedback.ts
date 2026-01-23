import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type FeedbackActionType = 'like' | 'dislike' | 'cart' | 'purchase' | 'click' | 'view' | 'style_like' | 'style_dislike';

interface RecordFeedbackParams {
  productId: string;
  actionType: FeedbackActionType;
  recommendationId?: string;
  styleConcept?: string;
  occasion?: string;
  additionalContext?: Record<string, any>;
}

export function useProductFeedback() {
  const queryClient = useQueryClient();

  const recordFeedback = useMutation({
    mutationFn: async (params: RecordFeedbackParams) => {
      const { data, error } = await supabase.functions.invoke('record-feedback', {
        body: params
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // 관련 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['liked-products'] });
      queryClient.invalidateQueries({ queryKey: ['cart-items'] });
    },
  });

  // 편의 함수들
  const likeProduct = (productId: string, styleConcept?: string, occasion?: string) => {
    return recordFeedback.mutateAsync({
      productId,
      actionType: 'like',
      styleConcept,
      occasion
    });
  };

  const dislikeProduct = (productId: string, styleConcept?: string, occasion?: string) => {
    return recordFeedback.mutateAsync({
      productId,
      actionType: 'dislike',
      styleConcept,
      occasion
    });
  };

  const addToCart = (productId: string, styleConcept?: string, occasion?: string) => {
    return recordFeedback.mutateAsync({
      productId,
      actionType: 'cart',
      styleConcept,
      occasion
    });
  };

  const recordPurchase = (productId: string, styleConcept?: string, occasion?: string) => {
    return recordFeedback.mutateAsync({
      productId,
      actionType: 'purchase',
      styleConcept,
      occasion
    });
  };

  const recordClick = (productId: string, styleConcept?: string) => {
    return recordFeedback.mutateAsync({
      productId,
      actionType: 'click',
      styleConcept
    });
  };

  const recordView = (productId: string, styleConcept?: string) => {
    return recordFeedback.mutateAsync({
      productId,
      actionType: 'view',
      styleConcept
    });
  };

  return {
    recordFeedback: recordFeedback.mutate,
    recordFeedbackAsync: recordFeedback.mutateAsync,
    likeProduct,
    dislikeProduct,
    addToCart,
    recordPurchase,
    recordClick,
    recordView,
    isLoading: recordFeedback.isPending,
    error: recordFeedback.error,
  };
}
