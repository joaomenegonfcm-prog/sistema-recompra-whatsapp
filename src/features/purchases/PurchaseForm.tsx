import { useState, type FormEvent } from 'react';
import { Button } from '../../components/UI/Button';
import { Card } from '../../components/UI/Card';
import { Input } from '../../components/UI/Input';
import { formatDateToInputValue } from '../../lib/formatters';
import { validatePurchaseInput } from '../../lib/validators';
import { createPurchase } from './purchasesService';

type PurchaseFormProps = {
  initialCustomerName?: string;
  initialPhone?: string;
  defaultReorderDays?: number;
  onSuccess?: () => void;
};

export function PurchaseForm({
  initialCustomerName = '',
  initialPhone = '',
  defaultReorderDays = 30,
  onSuccess,
}: PurchaseFormProps) {
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [phone, setPhone] = useState(initialPhone);
  const [product, setProduct] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(formatDateToInputValue(new Date()));
  const [reorderDays, setReorderDays] = useState(String(defaultReorderDays));
  const [observation, setObservation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralError(null);

    const numericReorderDays = Number(reorderDays);
    const validationErrors = validatePurchaseInput({
      customerName,
      phone,
      product,
      purchaseDate,
      reorderDays: numericReorderDays,
    });

    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      await createPurchase({
        customerName,
        phone,
        product,
        purchaseDate,
        reorderDays: numericReorderDays,
        observation,
      });
      onSuccess?.();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Erro ao cadastrar compra:', error);
      }

      setGeneralError('Não foi possível cadastrar a compra. Verifique os dados e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="purchase-form-card">
      <form className="purchase-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <Input
            id="customer-name"
            label="Nome do cliente"
            placeholder="Ex.: Maria Silva"
            autoComplete="name"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            aria-invalid={Boolean(errors.customerName)}
            aria-describedby={errors.customerName ? 'customer-name-error' : undefined}
          />
          {errors.customerName && <span id="customer-name-error" className="field-error">{errors.customerName}</span>}
        </div>

        <div className="form-field">
          <Input
            id="customer-phone"
            label="Telefone"
            placeholder="(17) 99999-9999"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'customer-phone-error' : undefined}
          />
          {errors.phone && <span id="customer-phone-error" className="field-error">{errors.phone}</span>}
        </div>

        <div className="form-field form-field-wide">
          <Input
            id="product-name"
            label="Produto"
            placeholder="Ex.: Kit de vitaminas"
            value={product}
            onChange={(event) => setProduct(event.target.value)}
            aria-invalid={Boolean(errors.product)}
            aria-describedby={errors.product ? 'product-name-error' : undefined}
          />
          {errors.product && <span id="product-name-error" className="field-error">{errors.product}</span>}
        </div>

        <div className="form-field">
          <Input
            id="purchase-date"
            label="Data da compra"
            type="date"
            value={purchaseDate}
            onChange={(event) => setPurchaseDate(event.target.value)}
            aria-invalid={Boolean(errors.purchaseDate)}
            aria-describedby={errors.purchaseDate ? 'purchase-date-error' : undefined}
          />
          {errors.purchaseDate && <span id="purchase-date-error" className="field-error">{errors.purchaseDate}</span>}
        </div>

        <div className="form-field">
          <Input
            id="reorder-days"
            label="Dias para recompra"
            type="number"
            min="1"
            step="1"
            value={reorderDays}
            onChange={(event) => setReorderDays(event.target.value)}
            aria-invalid={Boolean(errors.reorderDays)}
            aria-describedby={errors.reorderDays ? 'reorder-days-error' : undefined}
          />
          {errors.reorderDays && <span id="reorder-days-error" className="field-error">{errors.reorderDays}</span>}
        </div>

        <label className="field form-field-wide" htmlFor="purchase-observation">
          <span>Observação</span>
          <textarea
            id="purchase-observation"
            className="textarea"
            placeholder="Informações adicionais sobre a compra"
            rows={4}
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
          />
        </label>

        {generalError && (
          <div className="form-message form-message-error form-field-wide" role="alert">
            {generalError}
          </div>
        )}

        <div className="form-actions form-field-wide">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Salvar compra'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
