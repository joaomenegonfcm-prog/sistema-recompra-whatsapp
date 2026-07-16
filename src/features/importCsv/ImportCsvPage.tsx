import { useState, type ChangeEvent } from 'react';
import { FileText, RotateCcw, ShoppingBag, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/UI/Button';
import { Card } from '../../components/UI/Card';
import { Loading } from '../../components/UI/Loading';
import { createPurchase } from '../purchases/purchasesService';
import { CsvPreviewTable } from './CsvPreviewTable';
import {
  parseCsvFile,
  validateCsvColumns,
  validateCsvRows,
  type ValidatedCsvRow,
} from './importCsvService';

type ImportFailure = {
  index: number;
  message: string;
};

type ImportResult = {
  importedCount: number;
  failedCount: number;
  failures: ImportFailure[];
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === 'object' && error && 'message' in error) {
    return String(error.message);
  }

  return 'Erro desconhecido.';
}

export function ImportCsvPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ValidatedCsvRow[]>([]);
  const [columnErrors, setColumnErrors] = useState<string[]>([]);
  const [loadingParse, setLoadingParse] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);

  const validRowsCount = rows.filter((row) => row.errors.length === 0 && row.normalized).length;
  const invalidRowsCount = rows.length - validRowsCount;

  function resetImport() {
    setSelectedFile(null);
    setRows([]);
    setColumnErrors([]);
    setImportResult(null);
    setGeneralError(null);
    setLoadingParse(false);
    setImporting(false);
    setInputKey((key) => key + 1);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setSelectedFile(null);
    setRows([]);
    setColumnErrors([]);
    setImportResult(null);
    setGeneralError(null);

    if (!file) return;

    const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type.toLowerCase().includes('csv');
    if (!isCsv) {
      setGeneralError('Selecione um arquivo no formato CSV.');
      return;
    }

    setSelectedFile(file);
    setLoadingParse(true);

    try {
      const parsedRows = await parseCsvFile(file);
      setColumnErrors(validateCsvColumns(parsedRows));
      setRows(validateCsvRows(parsedRows));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Erro ao ler CSV:', error);
      }

      setGeneralError('Não foi possível ler o CSV. Verifique o arquivo e tente novamente.');
    } finally {
      setLoadingParse(false);
    }
  }

  async function handleImport() {
    const validRows = rows.filter(
      (row): row is ValidatedCsvRow & { normalized: NonNullable<ValidatedCsvRow['normalized']> } =>
        row.errors.length === 0 && row.normalized !== null,
    );

    if (validRows.length === 0) {
      setGeneralError('Não há linhas válidas para importar.');
      return;
    }

    setImporting(true);
    setGeneralError(null);
    setImportResult(null);

    let importedCount = 0;
    const failures: ImportFailure[] = [];

    for (const row of validRows) {
      try {
        await createPurchase(row.normalized);
        importedCount += 1;
      } catch (error) {
        failures.push({ index: row.index, message: getErrorMessage(error) });

        if (import.meta.env.DEV) {
          console.error(`Erro ao importar linha ${row.index}:`, error);
        }
      }
    }

    setImportResult({
      importedCount,
      failedCount: failures.length,
      failures,
    });
    setImporting(false);
  }

  return (
    <section className="page-section">
      <div className="page-title">
          <p className="eyebrow">Importação</p>
          <h1>Importar CSV</h1>
          <p>Importe compras em lote para criar ciclos de recompra.</p>
      </div>

      <Card className="import-instructions">
        <div>
          <h2>Formato esperado</h2>
          <p>Use a primeira linha para os nomes das colunas. A observação é opcional.</p>
        </div>
        <code>cliente,telefone,produto,data_compra,dias_recompra,observacao</code>
      </Card>

      {!importResult && (
        <label className="file-input-area" htmlFor="csv-file">
          <input
            key={inputKey}
            id="csv-file"
            className="file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void handleFileChange(event)}
            disabled={loadingParse || importing}
          />
          <Upload size={24} aria-hidden="true" />
          <strong>{selectedFile?.name ?? 'Selecionar arquivo CSV'}</strong>
          <span>Escolha um arquivo com as compras que deseja importar.</span>
        </label>
      )}

      {loadingParse && (
        <div className="table-state">
          <Loading />
        </div>
      )}

      {generalError && <div className="error-message" role="alert">{generalError}</div>}

      {columnErrors.length > 0 && (
        <div className="csv-errors" role="alert">
          <strong>Corrija as colunas do arquivo:</strong>
          <ul>
            {columnErrors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      )}

      {rows.length > 0 && !loadingParse && (
        <>
          <div className="csv-summary" aria-label="Resumo da validação">
            <div><span>Total de linhas</span><strong>{rows.length}</strong></div>
            <div><span>Linhas válidas</span><strong>{validRowsCount}</strong></div>
            <div><span>Com erro</span><strong>{invalidRowsCount}</strong></div>
          </div>

          <CsvPreviewTable rows={rows} />

          {!importResult && (
            <div className="csv-import-actions">
              <Button
                type="button"
                onClick={() => void handleImport()}
                disabled={importing || validRowsCount === 0 || columnErrors.length > 0}
              >
                {importing ? <Loading /> : <><FileText size={18} aria-hidden="true" /> Importar linhas válidas</>}
              </Button>
            </div>
          )}
        </>
      )}

      {importResult && (
        <div className="import-result" role="status">
          <h2>Importação finalizada</h2>
          <p>
            {importResult.importedCount} compras importadas. {importResult.failedCount} falharam.
          </p>

          {importResult.failures.length > 0 && (
            <div className="csv-errors">
              <ul>
                {importResult.failures.map((failure) => (
                  <li key={failure.index}>
                    Linha {failure.index}: não foi possível importar. Motivo: {failure.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="import-result-actions">
            <Link className="button button-primary" to="/compras">
              <ShoppingBag size={18} aria-hidden="true" />
              Ver compras
            </Link>
            <Button type="button" variant="secondary" onClick={resetImport}>
              <RotateCcw size={18} aria-hidden="true" />
              Importar outro CSV
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
