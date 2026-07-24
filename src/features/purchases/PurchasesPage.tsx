import { useEffect, useState } from 'react';
import { AlertCircle, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/UI/Badge';
import { EmptyState } from '../../components/UI/EmptyState';
import { Loading } from '../../components/UI/Loading';
import { PURCHASE_STATUS_OPTIONS } from '../../lib/constants';
import { formatDate, formatPurchaseStatus } from '../../lib/formatters';
import {
  listPurchases,
  type PurchaseListItem,
  type PurchaseStatus,
} from './purchasesService';

type PurchaseFilter = PurchaseStatus | 'all';

export function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseListItem[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<PurchaseFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    listPurchases(selectedStatus)
      .then((data) => {
        if (active) {
          setPurchases(data);
        }
      })
      .catch((caughtError) => {
        if (!active) return;

        if (import.meta.env.DEV) {
          console.error('Erro ao listar compras:', caughtError);
        }

        setPurchases([]);
        setError('Não foi possível carregar as compras. Tente novamente.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [reloadKey, selectedStatus]);

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Compras</p>
          <h1>Compras</h1>
          <p>Acompanhe os ciclos de recompra cadastrados.</p>
        </div>
        <div className="page-actions">
          <Link className="button button-primary" to="/compras/nova">
            <Plus size={18} aria-hidden="true" />
            Nova compra
          </Link>
        </div>
      </div>

      <div className="filter-tabs" role="group" aria-label="Filtrar compras por status">
        {PURCHASE_STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="filter-tab"
            aria-pressed={selectedStatus === option.value}
            onClick={() => setSelectedStatus(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="table-state">
          <Loading />
        </div>
      ) : error ? (
        <div className="error-message" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <span>{error}</span>
          <button type="button" className="button button-secondary" onClick={() => setReloadKey((key) => key + 1)}>
            Tentar novamente
          </button>
        </div>
      ) : purchases.length === 0 ? (
        <EmptyState
          title={selectedStatus === 'all' ? 'Nenhuma compra cadastrada' : 'Nenhuma compra neste status'}
          description={
            selectedStatus === 'all'
              ? 'Cadastre uma compra manualmente para iniciar o primeiro ciclo de recompra.'
              : 'Altere o filtro para consultar compras com outros status.'
          }
          action={
            selectedStatus === 'all' ? (
              <Link className="button button-primary" to="/compras/nova">
                <Plus size={18} aria-hidden="true" />
                Nova compra
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="table-container purchases-responsive-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Produto</th>
                  <th>Data da compra</th>
                  <th>Data de recompra</th>
                  <th>Status</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>
                      {purchase.customers ? (
                        <Link className="table-link" to={`/clientes/${purchase.customers.id}`}>
                          {purchase.customers.name}
                        </Link>
                      ) : '-'}
                    </td>
                    <td className="table-nowrap">{purchase.customers?.phone ?? '-'}</td>
                    <td>{purchase.product}</td>
                    <td className="table-nowrap">{formatDate(purchase.purchase_date)}</td>
                    <td className="table-nowrap">{formatDate(purchase.reorder_date)}</td>
                    <td>
                      <Badge variant={purchase.status}>
                        {formatPurchaseStatus(purchase.status)}
                      </Badge>
                    </td>
                    <td className="table-observation">{purchase.observation || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="purchases-mobile-list" aria-label="Compras">
            {purchases.map((purchase) => (
              <li key={purchase.id}>
                <article className="mobile-data-card">
                  <div className="mobile-data-card-header">
                    <div className="mobile-data-card-title">
                      <h2>{purchase.product}</h2>
                      <Badge variant={purchase.status}>
                        {formatPurchaseStatus(purchase.status)}
                      </Badge>
                    </div>
                    <p>
                      {purchase.customers ? (
                        <Link className="table-link" to={`/clientes/${purchase.customers.id}`}>
                          {purchase.customers.name}
                        </Link>
                      ) : '-'}
                    </p>
                  </div>

                  <dl className="mobile-data-card-meta">
                    <div>
                      <dt>Telefone</dt>
                      <dd>{purchase.customers?.phone ?? '-'}</dd>
                    </div>
                    <div>
                      <dt>Data da compra</dt>
                      <dd>{formatDate(purchase.purchase_date)}</dd>
                    </div>
                    <div>
                      <dt>Data de recompra</dt>
                      <dd>{formatDate(purchase.reorder_date)}</dd>
                    </div>
                    <div className="mobile-data-card-meta-wide">
                      <dt>Observação</dt>
                      <dd>{purchase.observation || '-'}</dd>
                    </div>
                  </dl>
                </article>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
