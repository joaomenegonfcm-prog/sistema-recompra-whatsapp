import { useEffect, useMemo, useState } from 'react';
import { FileUp, History, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/UI/Badge';
import { Button } from '../../components/UI/Button';
import { EmptyState } from '../../components/UI/EmptyState';
import { Loading } from '../../components/UI/Loading';
import { formatDate, formatPhone, normalizePhone } from '../../lib/formatters';
import { countValidRepurchases, isMetricPurchaseValid } from '../../lib/repurchase';
import { listCustomers, type CustomerListItem } from './customersService';

function countPurchasesByStatus(customer: CustomerListItem, status: string): number {
  return customer.purchases.filter(
    (purchase) => isMetricPurchaseValid(purchase) && purchase.status === status,
  ).length;
}

function getValidPurchases(customer: CustomerListItem) {
  return customer.purchases.filter(isMetricPurchaseValid);
}

function getLatestPurchase(customer: CustomerListItem) {
  return getValidPurchases(customer).reduce<CustomerListItem['purchases'][number] | null>(
    (latest, purchase) => {
      if (!latest) return purchase;

      if (purchase.purchase_date !== latest.purchase_date) {
        return purchase.purchase_date > latest.purchase_date ? purchase : latest;
      }

      return purchase.created_at > latest.created_at ? purchase : latest;
    },
    null,
  );
}

function getLastPurchaseDate(customer: CustomerListItem): string | null {
  const latestPurchase = getLatestPurchase(customer);

  return latestPurchase?.purchase_date ?? null;
}

function compareCustomersByLatestPurchase(first: CustomerListItem, second: CustomerListItem) {
  const firstLatest = getLatestPurchase(first);
  const secondLatest = getLatestPurchase(second);

  if (!firstLatest && !secondLatest) {
    return first.name.localeCompare(second.name, 'pt-BR');
  }

  if (!firstLatest) return 1;
  if (!secondLatest) return -1;

  if (firstLatest.purchase_date !== secondLatest.purchase_date) {
    return secondLatest.purchase_date.localeCompare(firstLatest.purchase_date);
  }

  return secondLatest.created_at.localeCompare(firstLatest.created_at);
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    listCustomers()
      .then((data) => {
        if (active) setCustomers(data);
      })
      .catch((caughtError) => {
        if (!active) return;

        if (import.meta.env.DEV) {
          console.error('Erro ao carregar clientes:', caughtError);
        }

        setError('Não foi possível carregar os clientes. Tente novamente.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    const phoneSearch = normalizePhone(search);

    const filtered = normalizedSearch
      ? customers.filter((customer) =>
        customer.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch) ||
        (phoneSearch.length > 0 && normalizePhone(customer.phone).includes(phoneSearch)),
      )
      : customers;

    return [...filtered].sort(compareCustomersByLatestPurchase);
  }, [customers, search]);

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Clientes</p>
          <h1>Clientes</h1>
          <p>Consulte os clientes cadastrados e acompanhe o histórico de recompra.</p>
        </div>
        <div className="page-actions">
          <Link className="button button-primary" to="/compras/nova">
            <Plus size={18} aria-hidden="true" />
            Nova compra
          </Link>
        </div>
      </div>

      <div className="customers-toolbar">
        <Search size={18} aria-hidden="true" />
        <input
          className="input customer-search"
          type="search"
          placeholder="Buscar por nome ou telefone"
          aria-label="Buscar clientes por nome ou telefone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {loading ? (
        <div className="table-state"><Loading /></div>
      ) : error ? (
        <div className="error-message" role="alert">
          <span>{error}</span>
          <Button type="button" variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>
            Tentar novamente
          </Button>
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          title="Nenhum cliente encontrado"
          description="Cadastre uma compra para criar o primeiro cliente e iniciar um ciclo de recompra."
          action={
            <div className="empty-state-actions">
              <Link className="button button-primary" to="/compras/nova">
                <Plus size={18} aria-hidden="true" />
                Nova compra
              </Link>
              <Link className="button button-secondary" to="/importar-csv">
                <FileUp size={18} aria-hidden="true" />
                Importar CSV
              </Link>
            </div>
          }
        />
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          title="Nenhum resultado para esta busca"
          description="Revise o nome ou telefone informado."
        />
      ) : (
        <>
          <div className="table-container customers-responsive-table">
            <table className="data-table customer-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Total de compras</th>
                  <th>Ciclos ativos</th>
                  <th>Em acompanhamento</th>
                  <th>Recompras</th>
                  <th>Última compra</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="customer-name-cell">
                        <strong>{customer.name}</strong>
                        {customer.opt_out && <Badge variant="opt_out">Não contatar</Badge>}
                      </div>
                    </td>
                    <td className="table-nowrap">{formatPhone(customer.phone)}</td>
                    <td>{getValidPurchases(customer).length}</td>
                    <td>{countPurchasesByStatus(customer, 'active')}</td>
                    <td>{countPurchasesByStatus(customer, 'in_followup')}</td>
                    <td>{countValidRepurchases(customer.purchases)}</td>
                    <td className="table-nowrap">{formatDate(getLastPurchaseDate(customer))}</td>
                    <td>
                      <Link className="table-action-link" to={`/clientes/${customer.id}`}>
                        <History size={16} aria-hidden="true" />
                        Ver histórico
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="customers-mobile-list" aria-label="Clientes">
            {filteredCustomers.map((customer) => (
              <li key={customer.id}>
                <article className="mobile-data-card">
                  <div className="mobile-data-card-header">
                    <div className="mobile-data-card-title">
                      <h2>{customer.name}</h2>
                      {customer.opt_out && <Badge variant="opt_out">Não contatar</Badge>}
                    </div>
                    <p>{formatPhone(customer.phone)}</p>
                  </div>

                  <dl className="mobile-data-card-meta">
                    <div>
                      <dt>Total de compras</dt>
                      <dd>{getValidPurchases(customer).length}</dd>
                    </div>
                    <div>
                      <dt>Ciclos ativos</dt>
                      <dd>{countPurchasesByStatus(customer, 'active')}</dd>
                    </div>
                    <div>
                      <dt>Em acompanhamento</dt>
                      <dd>{countPurchasesByStatus(customer, 'in_followup')}</dd>
                    </div>
                    <div>
                      <dt>Recompras</dt>
                      <dd>{countValidRepurchases(customer.purchases)}</dd>
                    </div>
                    <div className="mobile-data-card-meta-wide">
                      <dt>Última compra</dt>
                      <dd>{formatDate(getLastPurchaseDate(customer))}</dd>
                    </div>
                  </dl>

                  <div className="mobile-data-card-actions">
                    <Link className="table-action-link" to={`/clientes/${customer.id}`}>
                      <History size={16} aria-hidden="true" />
                      Ver histórico
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
