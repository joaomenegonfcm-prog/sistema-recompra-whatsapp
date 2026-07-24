import { useId, useState } from 'react';
import { Check, ChevronDown, MessageCircle, Pause, ShoppingBag } from 'lucide-react';
import { Badge } from '../../components/UI/Badge';
import { Button } from '../../components/UI/Button';
import { Card } from '../../components/UI/Card';
import { formatDate, formatPhone, formatPurchaseStatus } from '../../lib/formatters';
import type { TodayContact } from './todayContactsService';

type ContactCardProps = {
  contact: TodayContact;
  onOpenWhatsApp: (contact: TodayContact) => void;
  onRegisterAttempt: (contact: TodayContact) => void;
  onPause: (contact: TodayContact) => void;
  onRegisterRepurchase: (contact: TodayContact) => void;
  isProcessing?: boolean;
};

function getAttemptLabel(attemptNumber: number | null): string {
  if (attemptNumber === null) return 'Limite atingido';
  return `${attemptNumber}ª tentativa`;
}

export function ContactCard({
  contact,
  onOpenWhatsApp,
  onRegisterAttempt,
  onPause,
  onRegisterRepurchase,
  isProcessing = false,
}: ContactCardProps) {
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const moreActionsId = useId();

  function handlePauseClick() {
    setIsMoreActionsOpen(false);
    onPause(contact);
  }

  return (
    <Card className="contact-card">
      <div className="contact-card-header">
        <div className="contact-card-title">
          <div>
            <h2>{contact.customer_name}</h2>
            <p>{formatPhone(contact.phone)}</p>
          </div>
          <Badge variant={contact.status}>{formatPurchaseStatus(contact.status)}</Badge>
        </div>
        <span className="attempt-pill">{getAttemptLabel(contact.next_attempt_number)}</span>
      </div>

      <dl className="contact-card-info">
        <div className="contact-card-info-wide">
          <dt>Produto</dt>
          <dd>{contact.product}</dd>
        </div>
        <div>
          <dt>Compra</dt>
          <dd>{formatDate(contact.purchase_date)}</dd>
        </div>
        <div>
          <dt>Recompra prevista</dt>
          <dd>{formatDate(contact.reorder_date)}</dd>
        </div>
        <div>
          <dt>Próximo contato</dt>
          <dd>{formatDate(contact.next_contact_date)}</dd>
        </div>
        <div>
          <dt>Tentativas feitas</dt>
          <dd>{contact.attempts_count}</dd>
        </div>
      </dl>

      <div className="contact-card-actions" role="group" aria-label="Ações principais">
        <Button
          type="button"
          onClick={() => onOpenWhatsApp(contact)}
          disabled={isProcessing || contact.customer_opt_out}
          title={contact.customer_opt_out ? 'Cliente marcado como não contatar.' : undefined}
        >
          <MessageCircle size={18} aria-hidden="true" />
          Abrir WhatsApp
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onRegisterAttempt(contact)}
          disabled={isProcessing || contact.next_attempt_number === null || contact.customer_opt_out}
        >
          <Check size={18} aria-hidden="true" />
          Confirmar envio
        </Button>
      </div>

      <div className="contact-card-secondary-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onRegisterRepurchase(contact)}
          disabled={isProcessing}
        >
          <ShoppingBag size={18} aria-hidden="true" />
          Registrar recompra
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="contact-more-actions-button"
          aria-expanded={isMoreActionsOpen}
          aria-controls={moreActionsId}
          onClick={() => setIsMoreActionsOpen((isOpen) => !isOpen)}
          disabled={isProcessing}
        >
          <ChevronDown size={18} aria-hidden="true" />
          Mais ações
        </Button>
      </div>

      {isMoreActionsOpen && (
        <div id={moreActionsId} className="contact-more-actions-panel">
          <Button type="button" variant="ghost" onClick={handlePauseClick} disabled={isProcessing}>
            <Pause size={18} aria-hidden="true" />
            Pausar contato
          </Button>
        </div>
      )}

      {contact.customer_opt_out && (
        <p className="contact-opt-out-note">Cliente marcado como não contatar.</p>
      )}
    </Card>
  );
}
