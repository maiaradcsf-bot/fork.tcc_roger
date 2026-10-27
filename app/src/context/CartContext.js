import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '../services/index.js';
import { useAuth } from './AuthContext.js';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { hasPermission } = useAuth();
  const [cart, setCart] = useState(null);
  const canManage = hasPermission('clients.cart.manage');

  const refreshCart = useCallback(async () => {
    if (!canManage) {
      setCart(null);
      return null;
    }
    const openCart = await api.client.getOpenCart();
    setCart(openCart);
    return openCart;
  }, [canManage]);

  useEffect(() => {
    refreshCart().catch(() => setCart(null));
  }, [refreshCart]);

  const itemsCount = (cart?.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const value = useMemo(() => ({ cart, itemsCount, canManage, refreshCart, setCart }), [cart, itemsCount, canManage, refreshCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart deve ser usado dentro de CartProvider');
  return context;
}
