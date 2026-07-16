import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge, type BadgeVariant } from '../../components/UI/Badge';
import { Button } from '../../components/UI/Button';
import { Card } from '../../components/UI/Card';
import { EmptyState } from '../../components/UI/EmptyState';
import { Loading } from '../../components/UI/Loading';
import {
  formatAttemptStatus,
  formatDate,
  formatDateTime,
  formatPhone,
  formatPurchaseStatus,
} from '../../lib/formatters';
import { getCustomerHistory, type CustomerHistory } from './customersService';

const purchaseBadgeVariants = new Set<BadgeVariant>([
  'active',
  'in_followup',
  'repurchased',
  'paused',
  'cancelled',
]);

function getBadgeVariant(status: string): BadgeVariant {
  return purchaseBadgeVariants.has(status as BadgeVariant) ? status as BadgeVariant : 'default';
}

export function CustomerHistoryPage() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<CustomerHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    if (!id) {
      setError('Cliente não identificado.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getCustomerHistory(id)
      .then((data) => {
        if (active) setCustomer(data);
      })
      .catch((caughtError) => {
        if (!active) return;

        if (import.meta.env.DEV) {
          console.error('Erro ao carregar histórico do cliente:', caughtError);
        }

        setError('Não foi possível carregar o histórico do cliente. Tente novamente.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  const purchases = useMemo(() => {
    if (!customer) return [];

    return [...customer.purchases]
      .sort((first, second) => {
        if (first.purchase_date !== second.purchase_date) {
          return second.purchase_date.localeCompare(first.purchase_date);
        }

        return second.created_at.localeCompare(first.created_at);
      })
      .map((purchase) => ({
        ...purchase,
        contact_attempts: [...purchase.contact_attempts]
          .sort((first, second) => first.attempt_number - second.attempt_number),
      }));
  }, [customer]);

  const summary = useMemo(() => ({
    total: purchases.length,
    active: purchases.filter((purchase) => purchase.status === 'active').length,
    inFollowup: purchases.filter((purchase) => purchase.status === 'in_followup').length,
    repurchased: purchases.filter((purchase) => purchase.status === 'repurchased').length,
    paused: purchases.filter((purchase) => purchase.status === 'paused').length,
  }), [purchases]);

  return (
    <section className="page-section">
      <div className="customer-history-actions">
        <Link className="button button-secondary" to="/clientes">
          <ArrowLeft size={18} aria-hidden="true" />
          Voltar para clientes
        </Link>
        {customer && (
          <Link
            className="button button-primary"
            to={`/compras/nova?cliente=${encodeURIComponent(customer.name)}&telefone=${encodeURIComponent(customer.phone)}`}
          >
            <Plus size={18} aria-hidden="true" />
            Registrar nova compra
          </Link>
        )}
      </div>

      {loading ? (
        <div className="table-state"><Loading /></div>
      ) : error ? (
        <div className="error-message" role="alert">
          <span>{error}</span>
          {id && (
            <Button type="button" variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>
              Tentar novamente
            </Button>
          )}
        </div>
      ) : customer ? (
        <>
          <header className="customer-history-header">
            <div>
              <p className="eyebrow">Histórico do cliente</p>
              <h1>{customer.name}</h1>
              <p>{formatPhone(customer.phone)}</p>
            </div>
            <dl>
              <div><dt>Cadastro</dt><dd>{formatDateTime(customer.created_at)}</dd></div>
              {customer.notes && <div><dt>Observações</dt><dd>{customer.notes}</dd></div>}
            </dl>
          </header>

          <div className="customer-summary-grid">
            <Card><span>Total de compras</span><strong>{summary.total}</strong></Card>
            <Card><span>Ciclos ativos</span><strong>{summary.active}</strong></Card>
            <Card><span>Em acompanhamento</span><strong>{summary.inFollowup}</strong></Card>
            <Card><span>Recompras registradas</span><strong>{summary.repurchased}</strong></Card>
            <Card><span>Pausados</span><strong>{summary.paused}</strong></Card>
          </div>

          <div className="history-section-title">
            <h2>Histórico de compras</h2>
          </div>

          {purchases.length === 0 ? (
            <EmptyState
              title="Nenhuma compra encontrada"
              description="Este cliente ainda não possui compras cadastradas."
            />
          ) : (
            <div className="purchase-history-list">
              {purchases.map((purchase) => (
                <Card key={purchase.id} className="purchase-history-card">
                  <div className="purchase-history-card-header">
                    <div>
                      <h2>{purchase.product}</h2>
                      <p>Compra em {formatDate(purchase.purchase_date)}</p>
                    </div>
                    <Badge variant={getBadgeVariant(purchase.status)}>
                      {formatPurchaseStatus(purchase.status)}
                    </Badge>
                  </div>

                  <dl className="purchase-history-meta">
                    <div><dt>Recompra prevista</dt><dd>{formatDate(purchase.reorder_date)}</dd></div>
                    <div><dt>Tentativas</dt><dd>{purchase.contact_attempts.length}</dd></div>
                    <div className="purchase-history-meta-wide">
                      <dt>Observação</dt><dd>{purchase.observation || '-'}</dd>
                    </div>
                  </dl>

                  <div className="attempts-list">
                    <h3>Tentativas de contato</h3>
                    {purchase.contact_attempts.length === 0 ? (
                      <p>Nenhuma tentativa registrada para esta compra.</p>
                    ) : purchase.contact_attempts.map((attempt) => (
                      <article key={attempt.id} className="attempt-item">
                        <div className="attempt-item-header">
                          <strong>{attempt.attempt_number}ª tentativa</strong>
                          <span className={`attempt-status attempt-status-${attempt.status}`}>
                            {formatAttemptStatus(attempt.status)}
                          </span>
                        </div>
                        <div className="attempt-item-meta">
                          <span>{formatDateTime(attempt.attempt_date)}</span>
                          <span>Canal: {attempt.channel}</span>
                        </div>
                        <p className="message-preview">{attempt.message}</p>
                      </article>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
