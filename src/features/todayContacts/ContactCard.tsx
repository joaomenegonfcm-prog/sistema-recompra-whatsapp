import { Check, MessageCircle, Pause, ShoppingBag } from 'lucide-react';
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

      <div className="contact-card-actions">
        <Button type="button" onClick={() => onOpenWhatsApp(contact)} disabled={isProcessing}>
          <MessageCircle size={18} aria-hidden="true" />
          Abrir WhatsApp
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onRegisterAttempt(contact)}
          disabled={isProcessing || contact.next_attempt_number === null}
        >
          <Check size={18} aria-hidden="true" />
          Marcar como enviado
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onRegisterRepurchase(contact)}
          disabled={isProcessing}
        >
          <ShoppingBag size={18} aria-hidden="true" />
          Registrar recompra
        </Button>
        <Button type="button" variant="ghost" onClick={() => onPause(contact)} disabled={isProcessing}>
          <Pause size={18} aria-hidden="true" />
          Pausar
        </Button>
      </div>
    </Card>
  );
}
