import { useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '../context/AuthContext.js';
import { useCart } from '../context/CartContext.js';
import { api } from '../services/index.js';

export function useAddToCart() {
  const { handleError } = useAuth();
  const { refreshCart } = useCart();
  const [request, setRequest] = useState(null);

  async function start(product) {
    try {
      const cart = await api.client.getOrCreateOpenCart();
      const existing = Number((cart.items || []).find((item) => Number(item.product_id) === Number(product.id))?.quantity || 0);
      const available = Number(product.stock ?? 0) - existing;
      if (available <= 0) {
        Alert.alert('Atenção', `Estoque disponível já está no carrinho para ${product.name}.`);
        return;
      }
      setRequest({ product, cartId: cart.id, available });
    } catch (error) {
      handleError(error, 'Falha ao adicionar requisição');
    }
  }

  async function confirm(quantity) {
    const current = request;
    setRequest(null);
    if (!current) return;
    try {
      const item = await api.client.addCartItem(current.cartId, current.product.id, quantity);
      await refreshCart();
      Alert.alert('Produto adicionado', `${current.product.name} foi adicionado ao carrinho. Quantidade no carrinho: ${item.quantity}`);
    } catch (error) {
      handleError(error, 'Falha ao adicionar requisição');
    }
  }

  const modalProps = {
    visible: Boolean(request),
    title: request ? `Adicionar requisição: ${request.product.name}` : '',
    message: request ? `Quantidade disponível: ${request.available}` : '',
    max: request?.available,
    onConfirm: confirm,
    onCancel: () => setRequest(null),
  };

  return { start, modalProps };
}
