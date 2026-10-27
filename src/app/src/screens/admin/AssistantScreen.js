import { AssistantChat } from '../../components/AssistantChat.js';
import { ROLES } from '../../services/index.js';

const QUESTIONS = ['O que está com estoque baixo?', 'Quais solicitações estão pendentes?', 'Mais solicitados nos últimos 30 dias'];

export default function AdminAssistantScreen() {
  return <AssistantChat role={ROLES.ADMIN} greeting="Olá! Posso consultar estoque, movimentações e solicitações para você." quickQuestions={QUESTIONS} />;
}
