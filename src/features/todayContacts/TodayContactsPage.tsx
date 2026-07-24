import { useCallback, useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/UI/Button';
import { EmptyState } from '../../components/UI/EmptyState';
import { Loading } from '../../components/UI/Loading';
import { Modal } from '../../components/UI/Modal';
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
  const [pauseContact, setPauseContact] = useState<TodayContact | null>(null);

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
    if (contact.customer_opt_out) {
      setError('Cliente marcado como não contatar.');
      return;
    }

    const message = getContactMessage(contact);
    if (!message) return;

    const link = buildWhatsAppLink({ phone: contact.phone, message });
    window.open(link, '_blank', 'noopener,noreferrer');
  }

  async function handleRegisterAttempt(contact: TodayContact) {
    if (contact.customer_opt_out) {
      setError('Cliente marcado como não contatar.');
      return;
    }

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

  function openPauseModal(contact: TodayContact) {
    setError(null);
    setSuccessMessage(null);
    setPauseContact(contact);
  }

  function closePauseModal() {
    if (processingPurchaseId) return;
    setPauseContact(null);
  }

  async function handlePause() {
    if (!pauseContact || processingPurchaseId) return;

    setProcessingPurchaseId(pauseContact.purchase_id);
    setError(null);
    setSuccessMessage(null);

    try {
      await pausePurchase(pauseContact.purchase_id);
      const refreshed = await loadData(false);
      if (refreshed) {
        setSuccessMessage('Ciclo pausado com sucesso.');
        setPauseContact(null);
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
      <div className="page-header">
        <div>
          <p className="eyebrow">Fila do dia</p>
          <h1>Contatos de Hoje</h1>
          <p>Clientes que devem ser chamados hoje ou que estão atrasados.</p>
        </div>
      </div>

      <p className="today-contact-instruction">
        Abra a conversa no WhatsApp, envie a mensagem e depois volte ao sistema para registrar o envio.
      </p>

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
              onPause={openPauseModal}
              onRegisterRepurchase={handleRegisterRepurchase}
              isProcessing={processingPurchaseId === contact.purchase_id}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={pauseContact !== null}
        title="Pausar contato"
        onClose={closePauseModal}
        preventClose={processingPurchaseId !== null}
      >
        {pauseContact && (
          <div className="pause-contact-modal">
            <p>
              Confirme a pausa do ciclo de recompra de <strong>{pauseContact.customer_name}</strong>{' '}
              para o produto <strong>{pauseContact.product}</strong>.
            </p>
            <p>
              Este ciclo sai da fila de Contatos de Hoje até que seja retomado por uma regra ou ação
              permitida pelo sistema.
            </p>
            <div className="pause-contact-modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={closePauseModal}
                disabled={processingPurchaseId !== null}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handlePause()}
                disabled={processingPurchaseId !== null}
              >
                {processingPurchaseId === pauseContact.purchase_id ? 'Pausando...' : 'Confirmar pausa'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
