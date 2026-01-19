import { useState, useEffect, useCallback } from "react";

export interface GuestCartItem {
  id: string;
  product_id: string;
  product_name: string;
  product_brand: string | null;
  product_price: number;
  product_image_url: string | null;
  product_url: string;
  affiliate_url?: string;
  quantity: number;
  added_at: string;
}

const GUEST_CART_KEY = "showmelook_guest_cart";

export function useGuestCart() {
  const [items, setItems] = useState<GuestCartItem[]>([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GUEST_CART_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load guest cart:", e);
    }
  }, []);

  // Save cart to localStorage whenever items change
  const saveCart = useCallback((newItems: GuestCartItem[]) => {
    try {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(newItems));
      setItems(newItems);
    } catch (e) {
      console.error("Failed to save guest cart:", e);
    }
  }, []);

  const addItem = useCallback(
    (item: Omit<GuestCartItem, "id" | "quantity" | "added_at">) => {
      setItems((prev) => {
        const existingIndex = prev.findIndex(
          (i) => i.product_id === item.product_id
        );

        let newItems: GuestCartItem[];
        if (existingIndex >= 0) {
          // Update quantity if already exists
          newItems = prev.map((i, idx) =>
            idx === existingIndex ? { ...i, quantity: i.quantity + 1 } : i
          );
        } else {
          // Add new item
          const newItem: GuestCartItem = {
            ...item,
            id: `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            quantity: 1,
            added_at: new Date().toISOString(),
          };
          newItems = [...prev, newItem];
        }

        saveCart(newItems);
        return newItems;
      });
    },
    [saveCart]
  );

  const removeItem = useCallback(
    (productId: string) => {
      setItems((prev) => {
        const newItems = prev.filter((i) => i.product_id !== productId);
        saveCart(newItems);
        return newItems;
      });
    },
    [saveCart]
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(productId);
        return;
      }

      setItems((prev) => {
        const newItems = prev.map((i) =>
          i.product_id === productId ? { ...i, quantity } : i
        );
        saveCart(newItems);
        return newItems;
      });
    },
    [saveCart, removeItem]
  );

  const clearCart = useCallback(() => {
    localStorage.removeItem(GUEST_CART_KEY);
    setItems([]);
  }, []);

  const getItemCount = useCallback(() => {
    return items.reduce((acc, item) => acc + item.quantity, 0);
  }, [items]);

  const getTotalPrice = useCallback(() => {
    return items.reduce(
      (acc, item) => acc + item.product_price * item.quantity,
      0
    );
  }, [items]);

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getItemCount,
    getTotalPrice,
  };
}
