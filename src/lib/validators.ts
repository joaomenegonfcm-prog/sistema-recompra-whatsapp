import { normalizePhone } from './formatters';

export function isRequired(value: string) {
  return value.trim().length > 0;
}

export function isValidDateString(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

export type PurchaseValidationInput = {
  customerName: string;
  phone: string;
  product: string;
  purchaseDate: string;
  reorderDays: number;
};

export function validatePurchaseInput(
  input: PurchaseValidationInput,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!isRequired(input.customerName)) {
    errors.customerName = 'Informe o nome do cliente.';
  }

  if (!isRequired(input.phone)) {
    errors.phone = 'Informe o telefone do cliente.';
  } else if (normalizePhone(input.phone).length < 10) {
    errors.phone = 'Informe um telefone com pelo menos 10 dígitos.';
  }

  if (!isRequired(input.product)) {
    errors.product = 'Informe o produto comprado.';
  }

  if (!isRequired(input.purchaseDate)) {
    errors.purchaseDate = 'Informe a data da compra.';
  }

  if (!Number.isFinite(input.reorderDays) || input.reorderDays <= 0) {
    errors.reorderDays = 'Informe um número de dias maior que zero.';
  }

  return errors;
}
