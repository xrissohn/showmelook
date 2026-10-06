import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Fired after anything adds to or removes from the signed-in user's cart,
// so every cart badge refreshes without a page reload.
export const CART_CHANGED_EVENT = 'sml:cart-changed';

export function notifyCartChanged() {
  window.dispatchEvent(new Event(CART_CHANGED_EVENT));
}

/** Number of items in the signed-in user's cart (cart_items rows). 0 when signed out. */
export function useCartCount(userId?: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { count: rows, error } = await supabase
        .from('cart_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (!cancelled && !error) setCount(rows ?? 0);
    };
    void load();
    const onChange = () => { void load(); };
    window.addEventListener(CART_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(CART_CHANGED_EVENT, onChange);
    };
  }, [userId]);

  return count;
}
