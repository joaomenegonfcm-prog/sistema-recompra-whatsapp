import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { addDays, format } from 'date-fns';
import { ArrowLeft, History, Pencil, Plus, Save } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge, type BadgeVariant } from '../../components/UI/Badge';
import { Button } from '../../components/UI/Button';
import { Card } from '../../components/UI/Card';
import { EmptyState } from '../../components/UI/EmptyState';
import { Input } from '../../components/UI/Input';
import { Loading } from '../../components/UI/Loading';
import { Modal } from '../../components/UI/Modal';
import {
  formatAttemptStatus,
  formatDate,
  formatDateTime,
  formatPhone,
  formatPurchaseStatus,
} from '../../lib/formatters';
import { countValidRepurchases, isMetricPurchaseValid } from '../../lib/repurchase';
import { isValidContactAttempt, type PurchaseStatus } from '../../types/purchase';
import {
  changePurchaseStatus,
  getPurchaseStatusHistoryByPurchaseIds,
  getUserPurchaseSettings,
  groupPurchaseStatusHistoryByPurchaseId,
  updatePurchase,
  type PurchaseAttemptHandling,
  type PurchaseStatusHistory,
} from '../purchases/purchasesService';
import {
  getCustomerHistory,
  updateCustomer,
  type CustomerHistory,
} from './customersService';

const purchaseBadgeVariants = new Set<BadgeVariant>([
  'active',
  'in_followup',
  'repurchased',
  'paused',
  'cancelled',
]);

type Purchase = CustomerHistory['purchases'][number];
type ModalState =
  | { type: 'customer' }
  | { type: 'purchase'; purchase: Purchase }
  | { type: 'status'; purchase: Purchase }
  | null;

type CustomerFormState = {
  name: string;
  phone: string;
};

type PurchaseFormState = {
  product: string;
  reorderDays: string;
  observation: string;
};

type StatusFormState = {
  newStatus: '' | PurchaseStatus;
  reason: string;
  attemptHandling: PurchaseAttemptHandling;
};

const emptyCustomerForm: CustomerFormState = { name: '', phone: '' };
const emptyPurchaseForm: PurchaseFormState = { product: '', reorderDays: '', observation: '' };
const emptyStatusForm: StatusFormState = { newStatus: '', reason: '', attemptHandling: 'keep' };

function getBadgeVariant(status: string): BadgeVariant {
  return purchaseBadgeVariants.has(status as BadgeVariant) ? status as BadgeVariant : 'default';
}

type StatusOptionContext = {
  status: PurchaseStatus;
  validAttemptsCount: number;
  maxAttempts: number;
};

function getAllowedStatusOptions({
  status,
  validAttemptsCount,
  maxAttempts,
}: StatusOptionContext): PurchaseStatus[] {
  if (status === 'active') return ['paused', 'cancelled'];
  if (status === 'in_followup') return ['active', 'paused', 'cancelled'];
  if (status === 'paused') {
    return [
      'active',
      ...(validAttemptsCount >= 1 && validAttemptsCount < maxAttempts ? ['in_followup' as const] : []),
      'cancelled',
    ];
  }
  if (status === 'cancelled') return ['paused'];
  return [];
}

function getPausedFollowupBlockedReason(validAttemptsCount: number, maxAttempts: number) {
  if (validAttemptsCount < 1) {
    return 'Em acompanhamento exige pelo menos uma tentativa válida.';
  }

  if (validAttemptsCount >= maxAttempts) {
    return 'O limite de tentativas válidas desta compra já foi atingido.';
  }

  return null;
}

function getStatusHelperText(status: PurchaseStatus) {
  if (status === 'repurchased') {
    return 'O status Recomprou é controlado automaticamente pelo sistema.';
  }

  return 'Informe o novo status e o motivo para registrar a auditoria.';
}

function calculateReorderPreview(purchaseDate: string, reorderDaysValue: string) {
  if (!reorderDaysValue.trim()) {
    return null;
  }

  const reorderDays = Number(reorderDaysValue);

  if (!Number.isInteger(reorderDays) || reorderDays <= 0) {
    return null;
  }

  const purchaseDateValue = new Date(`${purchaseDate}T00:00:00`);

  if (Number.isNaN(purchaseDateValue.getTime())) {
    return null;
  }

  return format(addDays(purchaseDateValue, reorderDays), 'dd/MM/yyyy');
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

export function CustomerHistoryPage() {
  const { id } = useParams();
  const hasCustomerRef = useRef(false);
  const currentCustomerIdRef = useRef<string | null>(null);
  const [customer, setCustomer] = useState<CustomerHistory | null>(null);
  const [statusHistory, setStatusHistory] = useState<Record<string, PurchaseStatusHistory[]>>({});
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusHistoryError, setStatusHistoryError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState<ModalState>(null);
  const [customerForm, setCustomerForm] = useState<CustomerFormState>(emptyCustomerForm);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormState>(emptyPurchaseForm);
  const [statusForm, setStatusForm] = useState<StatusFormState>(emptyStatusForm);

  useEffect(() => {
    hasCustomerRef.current = customer !== null;
    currentCustomerIdRef.current = customer?.id ?? null;
  }, [customer]);

  useEffect(() => {
    let active = true;

    async function loadCustomerHistory(customerId: string) {
      const hasCustomer = hasCustomerRef.current && currentCustomerIdRef.current === customerId;
      setInitialLoading(!hasCustomer);
      setRefreshing(hasCustomer);
      setError(null);
      setStatusHistoryError(null);

      if (!hasCustomer) {
        setCustomer(null);
        setStatusHistory({});
        setSuccessMessage(null);
        setModal(null);
        setModalError(null);
      }

      try {
        const [data, settings] = await Promise.all([
          getCustomerHistory(customerId),
          getUserPurchaseSettings(),
        ]);
        const purchaseIds = data.purchases.map((purchase) => purchase.id);

        if (!active) return;

        setCustomer(data);
        setMaxAttempts(settings.max_attempts);

        try {
          const history = await getPurchaseStatusHistoryByPurchaseIds(purchaseIds);
          if (!active) return;
          setStatusHistory(groupPurchaseStatusHistoryByPurchaseId(history));
        } catch (statusHistoryCaughtError) {
          if (!active) return;

          if (import.meta.env.DEV) {
            console.error('Erro ao carregar auditoria de status:', statusHistoryCaughtError);
          }

          setStatusHistory({});
          setStatusHistoryError('Não foi possível carregar o histórico de alterações de status.');
        }
      } catch (caughtError) {
        if (!active) return;

        if (import.meta.env.DEV) {
          console.error('Erro ao carregar histórico do cliente:', caughtError);
        }

        setError(
          getErrorMessage(caughtError, '') === 'Cliente não encontrado.'
            ? 'Cliente não encontrado.'
            : 'Não foi possível carregar o histórico do cliente. Tente novamente.',
        );
      } finally {
        if (active) {
          setInitialLoading(false);
          setRefreshing(false);
        }
      }
    }

    if (!id) {
      setError('Cliente não identificado.');
      setInitialLoading(false);
      return;
    }

    loadCustomerHistory(id);

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

  const summary = useMemo(() => {
    const validMetricPurchases = purchases.filter(isMetricPurchaseValid);

    return {
      total: validMetricPurchases.length,
      active: validMetricPurchases.filter((purchase) => purchase.status === 'active').length,
      inFollowup: validMetricPurchases.filter((purchase) => purchase.status === 'in_followup').length,
      repurchased: countValidRepurchases(purchases),
      paused: validMetricPurchases.filter((purchase) => purchase.status === 'paused').length,
    };
  }, [purchases]);

  function closeModal() {
    if (saving) return;
    setModal(null);
    setModalError(null);
  }

  function refreshAfterSuccess(message: string) {
    setSuccessMessage(message);
    setModal(null);
    setModalError(null);
    setReloadKey((key) => key + 1);
  }

  function openCustomerModal() {
    if (!customer) return;

    setCustomerForm({ name: customer.name, phone: customer.phone });
    setModalError(null);
    setSuccessMessage(null);
    setModal({ type: 'customer' });
  }

  function openPurchaseModal(purchase: Purchase) {
    setPurchaseForm({
      product: purchase.product,
      reorderDays: String(purchase.reorder_days),
      observation: purchase.observation ?? '',
    });
    setModalError(null);
    setSuccessMessage(null);
    setModal({ type: 'purchase', purchase });
  }

  function openStatusModal(purchase: Purchase) {
    const validAttemptsCount = purchase.contact_attempts.filter(isValidContactAttempt).length;
    const options = getAllowedStatusOptions({
      status: purchase.status,
      validAttemptsCount,
      maxAttempts,
    });
    setStatusForm({
      newStatus: options[0] ?? '',
      reason: '',
      attemptHandling: 'keep',
    });
    setModalError(null);
    setSuccessMessage(null);
    setModal({ type: 'status', purchase });
  }

  async function handleCustomerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customer) return;

    setModalError(null);
    setSaving(true);

    try {
      await updateCustomer({
        customerId: customer.id,
        name: customerForm.name,
        phone: customerForm.phone,
      });
      refreshAfterSuccess('Cliente atualizado com sucesso.');
    } catch (caughtError) {
      if (import.meta.env.DEV) {
        console.error('Erro ao atualizar cliente:', caughtError);
      }

      setModalError(getErrorMessage(caughtError, 'Não foi possível atualizar o cliente.'));
    } finally {
      setSaving(false);
    }
  }

  async function handlePurchaseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!modal || modal.type !== 'purchase') return;

    if (!purchaseForm.product.trim()) {
      setModalError('Informe o produto comprado.');
      return;
    }

    if (!purchaseForm.reorderDays.trim()) {
      setModalError('Informe um número inteiro de dias para recompra maior que zero.');
      return;
    }

    const reorderDays = Number(purchaseForm.reorderDays);

    if (!Number.isInteger(reorderDays) || reorderDays <= 0) {
      setModalError('Informe um número inteiro de dias para recompra maior que zero.');
      return;
    }

    setModalError(null);
    setSaving(true);

    try {
      await updatePurchase({
        purchaseId: modal.purchase.id,
        product: purchaseForm.product,
        reorderDays,
        observation: purchaseForm.observation,
      });
      refreshAfterSuccess('Compra atualizada com sucesso.');
    } catch (caughtError) {
      if (import.meta.env.DEV) {
        console.error('Erro ao atualizar compra:', caughtError);
      }

      setModalError(getErrorMessage(caughtError, 'Não foi possível atualizar a compra.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!modal || modal.type !== 'status' || !statusForm.newStatus) return;

    if (!statusForm.reason.trim()) {
      setModalError('Informe o motivo da alteração.');
      return;
    }

    const attemptHandling: PurchaseAttemptHandling =
      modal.purchase.status === 'in_followup' &&
      statusForm.newStatus === 'active'
        ? statusForm.attemptHandling
        : 'keep';

    setModalError(null);
    setSaving(true);

    try {
      await changePurchaseStatus({
        purchaseId: modal.purchase.id,
        newStatus: statusForm.newStatus,
        reason: statusForm.reason,
        attemptHandling,
      });
      refreshAfterSuccess('Status alterado com sucesso.');
    } catch (caughtError) {
      if (import.meta.env.DEV) {
        console.error('Erro ao alterar status:', caughtError);
      }

      setModalError(getErrorMessage(caughtError, 'Não foi possível alterar o status.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-section">
      <div className="customer-history-actions">
        <Link className="button button-secondary" to="/clientes">
          <ArrowLeft size={18} aria-hidden="true" />
          Voltar para clientes
        </Link>
        {customer && !refreshing && (
          <Link
            className="button button-primary"
            to={`/compras/nova?cliente=${encodeURIComponent(customer.name)}&telefone=${encodeURIComponent(customer.phone)}`}
          >
            <Plus size={18} aria-hidden="true" />
            Registrar nova compra
          </Link>
        )}
        {customer && refreshing && (
          <span className="button button-primary button-disabled-link" aria-disabled="true">
            <Plus size={18} aria-hidden="true" />
            Registrar nova compra
          </span>
        )}
      </div>

      {successMessage && (
        <div className="success-message" role="status">
          {successMessage}
        </div>
      )}

      {refreshing && customer && (
        <div className="refreshing-message" role="status">
          Atualizando dados...
        </div>
      )}

      {initialLoading ? (
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
            <div className="customer-history-details">
              <dl>
                <div><dt>Cadastro</dt><dd>{formatDateTime(customer.created_at)}</dd></div>
                {customer.notes && <div><dt>Observações</dt><dd>{customer.notes}</dd></div>}
              </dl>
              <Button type="button" variant="secondary" onClick={openCustomerModal} disabled={refreshing}>
                <Pencil size={16} aria-hidden="true" />
                Editar cliente
              </Button>
            </div>
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

          {statusHistoryError && purchases.length > 0 && (
            <div className="status-history-warning" role="alert">
              <span>{statusHistoryError}</span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setReloadKey((key) => key + 1)}
                disabled={refreshing}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {purchases.length === 0 ? (
            <EmptyState
              title="Nenhuma compra encontrada"
              description="Este cliente ainda não possui compras cadastradas."
            />
          ) : (
            <div className="purchase-history-list">
              {purchases.map((purchase) => {
                const validAttempts = purchase.contact_attempts.filter(isValidContactAttempt);
                const purchaseHistory = statusHistory[purchase.id] ?? [];
                const statusOptions = getAllowedStatusOptions({
                  status: purchase.status,
                  validAttemptsCount: validAttempts.length,
                  maxAttempts,
                });
                const pausedFollowupBlockedReason =
                  purchase.status === 'paused'
                    ? getPausedFollowupBlockedReason(validAttempts.length, maxAttempts)
                    : null;

                return (
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

                    <div className="purchase-card-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => openPurchaseModal(purchase)}
                        disabled={refreshing}
                      >
                        <Pencil size={16} aria-hidden="true" />
                        Editar compra
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => openStatusModal(purchase)}
                        disabled={statusOptions.length === 0 || refreshing}
                        title={getStatusHelperText(purchase.status)}
                      >
                        <History size={16} aria-hidden="true" />
                        Alterar status
                      </Button>
                    </div>
                    {pausedFollowupBlockedReason && (
                      <p className="status-option-note">{pausedFollowupBlockedReason}</p>
                    )}

                    <dl className="purchase-history-meta">
                      <div><dt>Recompra prevista</dt><dd>{formatDate(purchase.reorder_date)}</dd></div>
                      <div><dt>Dias para recompra</dt><dd>{purchase.reorder_days}</dd></div>
                      <div><dt>Tentativas válidas</dt><dd>{validAttempts.length}</dd></div>
                      <div><dt>Tentativas registradas</dt><dd>{purchase.contact_attempts.length}</dd></div>
                      <div className="purchase-history-meta-wide">
                        <dt>Observação</dt><dd>{purchase.observation || '-'}</dd>
                      </div>
                    </dl>

                    <div className="attempts-list">
                      <h3>Tentativas de contato</h3>
                      {purchase.contact_attempts.length === 0 ? (
                        <p>Nenhuma tentativa registrada para esta compra.</p>
                      ) : purchase.contact_attempts.map((attempt) => {
                        const voided = attempt.voided_at !== null;

                        return (
                          <article
                            key={attempt.id}
                            className={`attempt-item${voided ? ' attempt-item-voided' : ''}`}
                          >
                            <div className="attempt-item-header">
                              <strong>{attempt.attempt_number}ª tentativa</strong>
                              <span className={`attempt-status attempt-status-${voided ? 'voided' : attempt.status}`}>
                                {voided ? 'Anulada' : formatAttemptStatus(attempt.status)}
                              </span>
                            </div>
                            <div className="attempt-item-meta">
                              <span>{formatDateTime(attempt.attempt_date)}</span>
                              <span>Canal: {attempt.channel}</span>
                            </div>
                            {voided && (
                              <p className="attempt-voided-note">
                                Anulada em {formatDateTime(attempt.voided_at)}.
                                {attempt.voided_reason ? ` Motivo: ${attempt.voided_reason}` : ''}
                              </p>
                            )}
                            <p className="message-preview">{attempt.message}</p>
                          </article>
                        );
                      })}
                    </div>

                    {!statusHistoryError && (
                      <div className="status-history-list">
                        <h3>Alterações de status</h3>
                        {purchaseHistory.length === 0 ? (
                          <p>Nenhuma alteração manual registrada.</p>
                        ) : purchaseHistory.map((item) => {
                          const voidedAttempts = item.metadata?.voidedAttempts;

                          return (
                            <article key={item.id} className="status-history-item">
                              <div className="status-history-item-header">
                                <span>
                                  {formatPurchaseStatus(item.oldStatus)} → {formatPurchaseStatus(item.newStatus)}
                                </span>
                                <time>{formatDateTime(item.createdAt)}</time>
                              </div>
                              <p>Motivo: {item.reason}</p>
                              {item.attemptHandling === 'void_attempts' &&
                                typeof voidedAttempts === 'number' &&
                                voidedAttempts > 0 && (
                                  <small>Tentativas anuladas: {voidedAttempts}</small>
                                )}
                              {item.attemptHandling === 'void_attempts' &&
                                (typeof voidedAttempts !== 'number' || voidedAttempts <= 0) && (
                                  <small>Tentativas válidas anuladas.</small>
                                )}
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      <Modal
        isOpen={modal?.type === 'customer'}
        title="Editar cliente"
        onClose={closeModal}
        preventClose={saving}
      >
        <form className="modal-form" onSubmit={handleCustomerSubmit} noValidate>
          <Input
            id="customer-name"
            label="Nome"
            value={customerForm.name}
            onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <Input
            id="customer-phone"
            label="Telefone"
            value={customerForm.phone}
            onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))}
            required
          />
          {modalError && <div className="form-message form-message-error" role="alert">{modalError}</div>}
          <div className="form-actions">
            <Button type="submit" disabled={saving}>
              <Save size={16} aria-hidden="true" />
              {saving ? 'Salvando...' : 'Salvar cliente'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={modal?.type === 'purchase'}
        title="Editar compra"
        onClose={closeModal}
        preventClose={saving}
      >
        {modal?.type === 'purchase' && (
          <form className="modal-form" onSubmit={handlePurchaseSubmit} noValidate>
            <div className="read-only-field">
              <span>Data da compra</span>
              <strong>{formatDate(modal.purchase.purchase_date)}</strong>
              <p>A data da compra não pode ser alterada nesta versão.</p>
            </div>
            <Input
              id="purchase-product"
              label="Produto"
              value={purchaseForm.product}
              onChange={(event) => setPurchaseForm((current) => ({ ...current, product: event.target.value }))}
              required
            />
            <Input
              id="purchase-reorder-days"
              label="Dias para recompra"
              type="number"
              min={1}
              step={1}
              value={purchaseForm.reorderDays}
              onChange={(event) => setPurchaseForm((current) => ({ ...current, reorderDays: event.target.value }))}
              onWheel={(event) => event.currentTarget.blur()}
              required
            />
            {calculateReorderPreview(modal.purchase.purchase_date, purchaseForm.reorderDays) && (
              <p className="form-help">
                Nova previsão de recompra:{' '}
                {calculateReorderPreview(modal.purchase.purchase_date, purchaseForm.reorderDays)}
              </p>
            )}
            <label className="field" htmlFor="purchase-observation">
              <span>Observação</span>
              <textarea
                id="purchase-observation"
                className="textarea"
                value={purchaseForm.observation}
                onChange={(event) => setPurchaseForm((current) => ({ ...current, observation: event.target.value }))}
              />
            </label>
            {modalError && <div className="form-message form-message-error" role="alert">{modalError}</div>}
            <div className="form-actions">
              <Button type="submit" disabled={saving}>
                <Save size={16} aria-hidden="true" />
                {saving ? 'Salvando...' : 'Salvar compra'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={modal?.type === 'status'}
        title="Alterar status"
        onClose={closeModal}
        preventClose={saving}
      >
        {modal?.type === 'status' && (
          <form className="modal-form" onSubmit={handleStatusSubmit} noValidate>
            <div className="status-change-current">
              <span>Produto</span>
              <strong>{modal.purchase.product}</strong>
              <span>Status atual</span>
              <Badge variant={getBadgeVariant(modal.purchase.status)}>
                {formatPurchaseStatus(modal.purchase.status)}
              </Badge>
            </div>
            <label className="field" htmlFor="new-status">
              <span>Novo status</span>
              <select
                id="new-status"
                className="input"
                value={statusForm.newStatus}
                onChange={(event) => setStatusForm((current) => ({
                  ...current,
                  newStatus: event.target.value as StatusFormState['newStatus'],
                  attemptHandling: 'keep',
                }))}
                required
                disabled={
                  getAllowedStatusOptions({
                    status: modal.purchase.status,
                    validAttemptsCount: modal.purchase.contact_attempts.filter(isValidContactAttempt).length,
                    maxAttempts,
                  }).length === 0
                }
              >
                {getAllowedStatusOptions({
                  status: modal.purchase.status,
                  validAttemptsCount: modal.purchase.contact_attempts.filter(isValidContactAttempt).length,
                  maxAttempts,
                }).map((status) => (
                  <option key={status} value={status}>
                    {formatPurchaseStatus(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="status-reason">
              <span>Motivo da alteração</span>
              <textarea
                id="status-reason"
                className="textarea"
                placeholder="Ex.: compra pausada por engano"
                value={statusForm.reason}
                onChange={(event) => setStatusForm((current) => ({ ...current, reason: event.target.value }))}
                required
              />
            </label>
            {modal.purchase.status === 'in_followup' && statusForm.newStatus === 'active' && (
              <fieldset className="attempt-handling-options">
                <legend>Tentativas válidas atuais: {modal.purchase.contact_attempts.filter(isValidContactAttempt).length}</legend>
                <label>
                  <input
                    type="radio"
                    name="attempt-handling"
                    value="keep"
                    checked={statusForm.attemptHandling === 'keep'}
                    onChange={() => setStatusForm((current) => ({
                      ...current,
                      attemptHandling: 'keep',
                    }))}
                  />
                  <span>Manter tentativas registradas</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="attempt-handling"
                    value="void_attempts"
                    checked={statusForm.attemptHandling === 'void_attempts'}
                    onChange={() => setStatusForm((current) => ({
                      ...current,
                      attemptHandling: 'void_attempts',
                    }))}
                  />
                  <span>Anular tentativas válidas desta compra</span>
                </label>
                {statusForm.attemptHandling === 'void_attempts' && (
                  <p className="form-help">
                    As tentativas enviadas e ainda válidas continuarão no histórico, mas deixarão
                    de contar na régua de contato. {modal.purchase.contact_attempts.filter(isValidContactAttempt).length}{' '}
                    tentativa(s) válida(s) será/serão anulada(s).
                  </p>
                )}
              </fieldset>
            )}
            <p className="form-help">{getStatusHelperText(modal.purchase.status)}</p>
            {modalError && <div className="form-message form-message-error" role="alert">{modalError}</div>}
            <div className="form-actions">
              <Button
                type="submit"
                disabled={
                  saving ||
                  getAllowedStatusOptions({
                    status: modal.purchase.status,
                    validAttemptsCount: modal.purchase.contact_attempts.filter(isValidContactAttempt).length,
                    maxAttempts,
                  }).length === 0
                }
              >
                <Save size={16} aria-hidden="true" />
                {saving ? 'Salvando...' : 'Salvar status'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
