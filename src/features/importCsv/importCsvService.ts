import Papa from 'papaparse';
import { normalizePhone } from '../../lib/formatters';
import { isValidDateString } from '../../lib/validators';

export type CsvPurchaseRow = {
  cliente?: string;
  telefone?: string;
  produto?: string;
  data_compra?: string;
  dias_recompra?: string;
  observacao?: string;
};

export type ValidatedCsvRow = {
  index: number;
  raw: CsvPurchaseRow;
  normalized: {
    customerName: string;
    phone: string;
    product: string;
    purchaseDate: string;
    reorderDays: number;
    observation?: string;
  } | null;
  errors: string[];
};

const REQUIRED_COLUMNS: Array<keyof CsvPurchaseRow> = [
  'cliente',
  'telefone',
  'produto',
  'data_compra',
  'dias_recompra',
];

const COLUMN_ALIASES: Record<string, keyof CsvPurchaseRow> = {
  cliente: 'cliente',
  nome: 'cliente',
  nome_cliente: 'cliente',
  customer: 'cliente',
  customer_name: 'cliente',
  telefone: 'telefone',
  celular: 'telefone',
  phone: 'telefone',
  whatsapp: 'telefone',
  whats_app: 'telefone',
  produto: 'produto',
  product: 'produto',
  item: 'produto',
  data: 'data_compra',
  data_compra: 'data_compra',
  data_da_compra: 'data_compra',
  compra: 'data_compra',
  purchase_date: 'data_compra',
  dias: 'dias_recompra',
  dias_recompra: 'dias_recompra',
  dias_para_recompra: 'dias_recompra',
  prazo_recompra: 'dias_recompra',
  reorder_days: 'dias_recompra',
  observacao: 'observacao',
  observacoes: 'observacao',
  obs: 'observacao',
  notes: 'observacao',
};

function normalizeHeader(header: string): string {
  const normalized = header
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return COLUMN_ALIASES[normalized] ?? normalized;
}

export function parseCsvFile(file: File): Promise<CsvPurchaseRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvPurchaseRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      complete: (result) => resolve(result.data),
      error: (error) => reject(error),
    });
  });
}

export function validateCsvColumns(rows: CsvPurchaseRow[]): string[] {
  if (rows.length === 0) {
    return ['O CSV está vazio.'];
  }

  const columns = new Set(Object.keys(rows[0]));

  return REQUIRED_COLUMNS
    .filter((column) => !columns.has(column))
    .map((column) => `Coluna obrigatória ausente: ${column}`);
}

export function validateCsvRows(rows: CsvPurchaseRow[]): ValidatedCsvRow[] {
  return rows.map((raw, rowIndex) => {
    const customerName = raw.cliente?.trim() ?? '';
    const phone = normalizePhone(raw.telefone ?? '');
    const product = raw.produto?.trim() ?? '';
    const purchaseDate = raw.data_compra?.trim() ?? '';
    const reorderDaysText = raw.dias_recompra?.trim() ?? '';
    const reorderDays = Number(reorderDaysText);
    const observation = raw.observacao?.trim() || undefined;
    const errors: string[] = [];

    if (!customerName) errors.push('Cliente é obrigatório.');

    if (!raw.telefone?.trim()) {
      errors.push('Telefone é obrigatório.');
    } else if (phone.length < 10) {
      errors.push('Telefone deve ter pelo menos 10 dígitos.');
    }

    if (!product) errors.push('Produto é obrigatório.');

    if (!purchaseDate) {
      errors.push('Data da compra é obrigatória.');
    } else if (!isValidDateString(purchaseDate)) {
      errors.push('Data da compra deve ser válida no formato YYYY-MM-DD.');
    }

    if (!reorderDaysText) {
      errors.push('Dias para recompra é obrigatório.');
    } else if (!Number.isFinite(reorderDays) || reorderDays <= 0) {
      errors.push('Dias para recompra deve ser um número maior que zero.');
    }

    return {
      index: rowIndex + 2,
      raw,
      normalized: errors.length === 0
        ? {
            customerName,
            phone,
            product,
            purchaseDate,
            reorderDays,
            observation,
          }
        : null,
      errors,
    };
  });
}
