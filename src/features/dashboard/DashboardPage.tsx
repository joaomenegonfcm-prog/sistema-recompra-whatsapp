import { useCallback, useEffect, useState, type ComponentType } from 'react';
import {
  CalendarCheck,
  CheckCheck,
  Clock3,
  FileUp,
  PauseCircle,
  Plus,
  RefreshCw,
  Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/UI/Button';
import { Card } from '../../components/UI/Card';
import { Loading } from '../../components/UI/Loading';
import { getDashboardSummary, type DashboardSummary } from './dashboardService';

type SummaryCard = {
  key: keyof DashboardSummary;
  title: string;
  description: string;
  href?: string;
  icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  tone: 'blue' | 'yellow' | 'green' | 'gray' | 'red';
};

const summaryCards: SummaryCard[] = [
  {
    key: 'todayContacts',
    title: 'Contatos para hoje',
    description: 'Clientes que precisam ser chamados agora.',
    href: '/contatos-hoje',
    icon: CalendarCheck,
    tone: 'blue',
  },
  {
    key: 'inFollowup',
    title: 'Clientes em acompanhamento',
    description: 'Ciclos que já receberam tentativa.',
    href: '/compras',
    icon: Clock3,
    tone: 'yellow',
  },
  {
    key: 'repurchased',
    title: 'Recompras registradas',
    description: 'Ciclos encerrados por nova compra.',
    href: '/compras',
    icon: CheckCheck,
    tone: 'green',
  },
  {
    key: 'paused',
    title: 'Clientes pausados',
    description: 'Ciclos parados após pausa ou limite de tentativas.',
    href: '/compras',
    icon: PauseCircle,
    tone: 'gray',
  },
  {
    key: 'attemptsThisMonth',
    title: 'Tentativas feitas no mês',
    description: 'Mensagens marcadas como enviadas neste mês.',
    icon: Send,
    tone: 'red',
  },
];

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setSummary(await getDashboardSummary());
    } catch (caughtError) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar dashboard:', caughtError);
      }

      setError('Não foi possível carregar o dashboard. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Visão geral</p>
          <h1>Dashboard</h1>
          <p>Resumo dos ciclos de recompra.</p>
        </div>
        <div className="dashboard-actions">
          <Button type="button" variant="secondary" onClick={() => void loadSummary()} disabled={loading}>
            <RefreshCw size={18} aria-hidden="true" />
            Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="table-state">
          <Loading />
          <span className="sr-only">Carregando dashboard...</span>
        </div>
      ) : error ? (
        <div className="error-message" role="alert">
          <span>{error}</span>
          <Button type="button" variant="secondary" onClick={() => void loadSummary()}>
            Tentar novamente
          </Button>
        </div>
      ) : summary ? (
        <div className="dashboard-grid">
          {summaryCards.map((item) => {
            const Icon = item.icon;
            const content = (
              <Card className="dashboard-card">
                <div className={`dashboard-card-icon dashboard-card-icon-${item.tone}`}>
                  <Icon size={20} aria-hidden="true" />
                </div>
                <strong className="dashboard-card-value">{summary[item.key]}</strong>
                <h2 className="dashboard-card-title">{item.title}</h2>
                <p className="dashboard-card-description">{item.description}</p>
              </Card>
            );

            return item.href ? (
              <Link key={item.key} className="dashboard-card-link" to={item.href}>
                {content}
              </Link>
            ) : (
              <div key={item.key}>{content}</div>
            );
          })}
        </div>
      ) : null}

      <section className="quick-actions" aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title">Próximos passos</h2>
        <div className="quick-actions-grid">
          <Link className="quick-action-card" to="/contatos-hoje">
            <CalendarCheck size={19} aria-hidden="true" />
            <span>Ver contatos de hoje</span>
          </Link>
          <Link className="quick-action-card" to="/compras/nova">
            <Plus size={19} aria-hidden="true" />
            <span>Cadastrar nova compra</span>
          </Link>
          <Link className="quick-action-card" to="/importar-csv">
            <FileUp size={19} aria-hidden="true" />
            <span>Importar CSV</span>
          </Link>
        </div>
      </section>
    </section>
  );
}
