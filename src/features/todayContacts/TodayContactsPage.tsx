import { useCallback, useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/UI/Button';
import { EmptyState } from '../../components/UI/EmptyState';
import { Loading } from '../../components/UI/Loading';
import { buildWhatsAppLink, buildWhatsAppMessage } from '../../lib/whatsapp';
import { ContactCard } from './ContactCard';
import {
  getSettings,
  listTodayContacts,
  pausePurchase,
  registerAttempt,
  type TodayContact,
  type UserSettings,
} from './todayContactsService';

export function TodayContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<TodayContact[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processingPurchaseId, setProcessingPurchaseId] = useState<string | null>(null);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      const [nextSettings, nextContacts] = await Promise.all([
        getSettings(),
        listTodayContacts(),
      ]);

      setSettings(nextSettings);
      setContacts(nextContacts);
      return true;
    } catch (caughtError) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar contatos de hoje:', caughtError);
      }

      setError('Não foi possível carregar os contatos de hoje. Tente novamente.');
      return false;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function getContactMessage(contact: TodayContact): string | null {
    if (!settings) {
      setError('As configurações de mensagem não estão disponíveis.');
      return null;
    }

    return buildWhatsAppMessage({
      template: settings.default_message_template,
      customerName: contact.customer_name,
      product: contact.product,
    });
  }

  function handleOpenWhatsApp(contact: TodayContact) {
    const message = getContactMessage(contact);
    if (!message) return;

    const link = buildWhatsAppLink({ phone: contact.phone, message });
    window.open(link, '_blank', 'noopener,noreferrer');
  }

  async function handleRegisterAttempt(contact: TodayContact) {
    const message = getContactMessage(contact);
    if (!message) return;

    setProcessingPurchaseId(contact.purchase_id);
    setError(null);
    setSuccessMessage(null);

    try {
      await registerAttempt(contact.purchase_id, message);
      const refreshed = await loadData(false);
      if (refreshed) {
        setSuccessMessage('Tentativa registrada com sucesso.');
      }
    } catch (caughtError) {
      if (import.meta.env.DEV) {
        console.error('Erro ao registrar tentativa:', caughtError);
      }

      setError('Não foi possível registrar a tentativa. Tente novamente.');
    } finally {
      setProcessingPurchaseId(null);
    }
  }

  async function handlePause(contact: TodayContact) {
    if (!window.confirm('Deseja pausar este ciclo de recompra?')) return;

    setProcessingPurchaseId(contact.purchase_id);
    setError(null);
    setSuccessMessage(null);

    try {
      await pausePurchase(contact.purchase_id);
      const refreshed = await loadData(false);
      if (refreshed) {
        setSuccessMessage('Ciclo pausado com sucesso.');
      }
    } catch (caughtError) {
      if (import.meta.env.DEV) {
        console.error('Erro ao pausar ciclo:', caughtError);
      }

      setError('Não foi possível pausar o ciclo. Tente novamente.');
    } finally {
      setProcessingPurchaseId(null);
    }
  }

  function handleRegisterRepurchase(contact: TodayContact) {
    navigate(
      `/compras/nova?cliente=${encodeURIComponent(contact.customer_name)}&telefone=${encodeURIComponent(contact.phone)}`,
    );
  }

  return (
    <section className="page-section">
      <div className="page-title">
        <p className="eyebrow">Fila do dia</p>
        <h1>Contatos de Hoje</h1>
        <p>Clientes que devem ser chamados hoje ou que estão atrasados.</p>
      </div>

      {successMessage && (
        <div className="success-message" role="status">
          {successMessage}
        </div>
      )}

      {loading ? (
        <div className="table-state">
          <Loading />
        </div>
      ) : error ? (
        <div className="error-message" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <span>{error}</span>
          <Button type="button" variant="secondary" onClick={() => void loadData()}>
            Tentar novamente
          </Button>
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          title="Nenhum contato para hoje"
          description="Não há ciclos de recompra vencidos ou atrasados neste momento."
        />
      ) : (
        <div className="today-contacts-grid">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.purchase_id}
              contact={contact}
              onOpenWhatsApp={handleOpenWhatsApp}
              onRegisterAttempt={(item) => void handleRegisterAttempt(item)}
              onPause={(item) => void handlePause(item)}
              onRegisterRepurchase={handleRegisterRepurchase}
              isProcessing={processingPurchaseId === contact.purchase_id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
