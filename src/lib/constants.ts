export const APP_NAME = 'Sistema de Recompra por WhatsApp';

export const PURCHASE_STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  in_followup: 'Em acompanhamento',
  repurchased: 'Recomprou',
  paused: 'Pausado',
  cancelled: 'Cancelado',
};

export const PURCHASE_STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativo' },
  { value: 'in_followup', label: 'Em acompanhamento' },
  { value: 'repurchased', label: 'Recomprou' },
  { value: 'paused', label: 'Pausado' },
  { value: 'cancelled', label: 'Cancelado' },
] as const;

export const ATTEMPT_STATUS_LABELS: Record<string, string> = {
  sent: 'Enviada',
  failed: 'Falhou',
  cancelled: 'Cancelada',
};
