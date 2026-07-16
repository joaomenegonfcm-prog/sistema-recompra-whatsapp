import { CheckCircle2, XCircle } from 'lucide-react';
import type { ValidatedCsvRow } from './importCsvService';

type CsvPreviewTableProps = {
  rows: ValidatedCsvRow[];
};

export function CsvPreviewTable({ rows }: CsvPreviewTableProps) {
  return (
    <div className="csv-preview">
      <table className="data-table csv-preview-table">
        <thead>
          <tr>
            <th>Linha</th>
            <th>Cliente</th>
            <th>Telefone</th>
            <th>Produto</th>
            <th>Data da compra</th>
            <th>Dias recompra</th>
            <th>Observação</th>
            <th>Validação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.index} className={row.errors.length > 0 ? 'csv-row-invalid' : undefined}>
              <td>{row.index}</td>
              <td>{row.raw.cliente || '-'}</td>
              <td className="table-nowrap">{row.raw.telefone || '-'}</td>
              <td>{row.raw.produto || '-'}</td>
              <td className="table-nowrap">{row.raw.data_compra || '-'}</td>
              <td>{row.raw.dias_recompra || '-'}</td>
              <td>{row.raw.observacao || '-'}</td>
              <td className="csv-validation-cell">
                {row.errors.length === 0 ? (
                  <span className="validation-success">
                    <CheckCircle2 size={16} aria-hidden="true" />
                    Válida
                  </span>
                ) : (
                  <div className="validation-error">
                    <XCircle size={16} aria-hidden="true" />
                    <ul>
                      {row.errors.map((error) => <li key={error}>{error}</li>)}
                    </ul>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
