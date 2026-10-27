import { Alert } from 'react-native';

import { AssistantChat } from '../../components/AssistantChat.js';
import { useAuth } from '../../context/AuthContext.js';
import { useCart } from '../../context/CartContext.js';
import { ROLES, api } from '../../services/index.js';

const QUESTIONS = ['O que tem disponível?', 'Preciso de material para uma aula de desenho', 'Como estão minhas solicitações?'];

export default function ClientAssistantScreen() {
  const { hasPermission, handleError } = useAuth();
  const { canManage, refreshCart } = useCart();
  const canAdd = canManage && hasPermission('clients.products.request');

  async function addSuggestion(item) {
    try {
      const cart = await api.client.getOrCreateOpenCart();
      await api.client.addCartItem(cart.id, item.product_id, item.quantity);
      await refreshCart();
      return true;
    } catch (error) {
      if (error?.isUnauthorized) handleError(error);
      else Alert.alert('Atenção', `Não foi possível adicionar ${item.name}: ${error.message}`);
      return false;
    }
  }

  return (
    <AssistantChat
      role={ROLES.CLIENT}
      greeting="Olá! Posso mostrar o que está disponível no almoxarifado e ajudar a montar sua solicitação."
      quickQuestions={QUESTIONS}
      onAddSuggestion={canAdd ? addSuggestion : undefined}
    />
  );
}
