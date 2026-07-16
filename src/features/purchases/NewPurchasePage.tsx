import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loading } from '../../components/UI/Loading';
import { PurchaseForm } from './PurchaseForm';
import { getUserPurchaseSettings } from './purchasesService';

export function NewPurchasePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [defaultReorderDays, setDefaultReorderDays] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const initialCustomerName = searchParams.get('cliente') ?? '';
  const initialPhone = searchParams.get('telefone') ?? '';

  useEffect(() => {
    let active = true;

    getUserPurchaseSettings().then((settings) => {
      if (active) {
        setDefaultReorderDays(settings.default_reorder_days);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!saved) return;

    const timeout = window.setTimeout(() => {
      navigate('/compras', { replace: true });
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [navigate, saved]);

  return (
    <section className="page-section">
      <div className="page-title">
        <p className="eyebrow">Cadastro manual</p>
        <h1>Nova compra</h1>
        <p>Cadastre uma compra para iniciar um ciclo de recompra.</p>
      </div>

      {saved ? (
        <div className="form-message form-message-success purchase-success" role="status">
          Compra cadastrada com sucesso. Redirecionando...
        </div>
      ) : defaultReorderDays === null ? (
        <div className="form-loading">
          <Loading />
        </div>
      ) : (
        <PurchaseForm
          initialCustomerName={initialCustomerName}
          initialPhone={initialPhone}
          defaultReorderDays={defaultReorderDays}
          onSuccess={() => setSaved(true)}
        />
      )}
    </section>
  );
}
