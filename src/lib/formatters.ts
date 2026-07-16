import { format } from 'date-fns';
import { ATTEMPT_STATUS_LABELS, PURCHASE_STATUS_LABELS } from './constants';

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '-';

  const clean = normalizePhone(phone);

  if (clean.startsWith('55') && clean.length >= 12) {
    const withoutCountry = clean.slice(2);
    const ddd = withoutCountry.slice(0, 2);
    const number = withoutCountry.slice(2);

    if (number.length === 9) {
      return `+55 (${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
    }

    if (number.length === 8) {
      return `+55 (${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
    }
  }

  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }

  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }

  return phone;
}

export function formatDateToInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatPurchaseStatus(status: string): string {
  return PURCHASE_STATUS_LABELS[status] ?? status;
}

export function formatAttemptStatus(status: string): string {
  return ATTEMPT_STATUS_LABELS[status] ?? status;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '-';

  const parsedDate = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR').format(parsedDate);
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '-';

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsedDate);
}
