import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * 사용자 피드백 수집 훅
 * 
 * 자체 학습 시스템을 위한 사용자 상호작용 데이터 수집
 */

type ActionType = 'view' | 'click' | 'like' | 'cart' | 'purchase';

interface FeedbackContext {
  gender?: string;
  occasion?: string;
  concepts?: string[];
  budget?: number;
  position?: number;
}

interface FeedbackData {
  productId: string;
  actionType: ActionType;
  recommendationId?: string;
  context?: FeedbackContext;
}

export function useFeedback() {
  /**
   * 단일 피드백 전송
   */
  const sendFeedback = useCallback(async (data: FeedbackData) => {
    try {
      const { error } = await supabase.functions.invoke('feedback-collect', {
        body: {
          productId: data.productId,
          actionType: data.actionType,
          recommendationId: data.recommendationId,
          context: data.context,
        },
      });

      if (error) {
        console.error('[useFeedback] Error:', error);
        return false;
      }

      return true;
    } catch (e) {
      console.error('[useFeedback] Exception:', e);
      return false;
    }
  }, []);

  /**
   * 배치 피드백 전송 (여러 상품 한번에)
   */
  const sendBatchFeedback = useCallback(async (feedbacks: FeedbackData[]) => {
    if (feedbacks.length === 0) return true;

    try {
      const { error } = await supabase.functions.invoke('feedback-collect', {
        body: {
          feedbacks: feedbacks.map(fb => ({
            productId: fb.productId,
            actionType: fb.actionType,
            recommendationId: fb.recommendationId,
            context: fb.context,
          })),
        },
      });

      if (error) {
        console.error('[useFeedback] Batch error:', error);
        return false;
      }

      return true;
    } catch (e) {
      console.error('[useFeedback] Batch exception:', e);
      return false;
    }
  }, []);

  /**
   * 상품 클릭 피드백
   */
  const trackClick = useCallback((
    productId: string, 
    context?: FeedbackContext,
    recommendationId?: string
  ) => {
    return sendFeedback({
      productId,
      actionType: 'click',
      recommendationId,
      context,
    });
  }, [sendFeedback]);

  /**
   * 상품 조회 피드백 (리스트에 노출 시)
   */
  const trackViews = useCallback((
    productIds: string[], 
    context?: FeedbackContext,
    recommendationId?: string
  ) => {
    const feedbacks: FeedbackData[] = productIds.map((productId, index) => ({
      productId,
      actionType: 'view' as ActionType,
      recommendationId,
      context: { ...context, position: index },
    }));

    return sendBatchFeedback(feedbacks);
  }, [sendBatchFeedback]);

  /**
   * 좋아요 피드백
   */
  const trackLike = useCallback((
    productId: string, 
    context?: FeedbackContext,
    recommendationId?: string
  ) => {
    return sendFeedback({
      productId,
      actionType: 'like',
      recommendationId,
      context,
    });
  }, [sendFeedback]);

  /**
   * 장바구니 추가 피드백
   */
  const trackCart = useCallback((
    productId: string, 
    context?: FeedbackContext,
    recommendationId?: string
  ) => {
    return sendFeedback({
      productId,
      actionType: 'cart',
      recommendationId,
      context,
    });
  }, [sendFeedback]);

  /**
   * 구매 피드백
   */
  const trackPurchase = useCallback((
    productId: string, 
    context?: FeedbackContext,
    recommendationId?: string
  ) => {
    return sendFeedback({
      productId,
      actionType: 'purchase',
      recommendationId,
      context,
    });
  }, [sendFeedback]);

  return {
    sendFeedback,
    sendBatchFeedback,
    trackClick,
    trackViews,
    trackLike,
    trackCart,
    trackPurchase,
  };
}
