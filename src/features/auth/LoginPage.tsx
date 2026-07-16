import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../../components/UI/Card';
import { Input } from '../../components/UI/Input';
import { Button } from '../../components/UI/Button';
import { useAuth } from './useAuth';

function getFriendlyLoginError(message: string) {
  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'E-mail ou senha inválidos.';
  }

  if (message.toLowerCase().includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.';
  }

  return 'Não foi possível entrar. Confira seus dados e tente novamente.';
}

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, configurationError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Preencha o e-mail e a senha.');
      return;
    }

    setSubmitting(true);

    try {
      const { error: authError } = await signIn(email.trim(), password);

      if (authError) {
        setError(getFriendlyLoginError(authError.message));
        return;
      }

      navigate('/dashboard', { replace: true });
    } catch {
      setError('Não foi possível entrar. Confira sua conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <div className="auth-heading">
          <span className="brand-mark" aria-hidden="true">SR</span>
          <div>
            <p className="eyebrow">Sistema de Recompra</p>
            <h1>Entre na sua conta</h1>
            <p>Acesse sua operação de recompra por WhatsApp.</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Input
            id="email"
            label="E-mail"
            placeholder="voce@loja.com"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            id="password"
            label="Senha"
            placeholder="Sua senha"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {(error || configurationError) && (
            <div className="form-message form-message-error" role="alert">
              {error ?? configurationError}
            </div>
          )}

          <Button type="submit" disabled={submitting || Boolean(configurationError)}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <p className="auth-footer">
          Ainda não tem uma conta? <Link className="text-link" to="/register">Criar cadastro</Link>
        </p>
      </Card>
    </main>
  );
}
