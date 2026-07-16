import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../../components/UI/Card';
import { Input } from '../../components/UI/Input';
import { Button } from '../../components/UI/Button';
import { useAuth } from './useAuth';

function getFriendlyRegisterError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('already registered') || normalizedMessage.includes('already been registered')) {
    return 'Este e-mail já possui uma conta.';
  }

  if (normalizedMessage.includes('password')) {
    return 'A senha não atende aos requisitos de segurança.';
  }

  return 'Não foi possível criar a conta. Tente novamente.';
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { signUp, configurationError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password || !passwordConfirmation) {
      setError('Preencha todos os campos.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (password !== passwordConfirmation) {
      setError('A confirmação de senha deve ser igual à senha.');
      return;
    }

    setSubmitting(true);

    try {
      const { data, error: authError } = await signUp(email.trim(), password);

      if (authError) {
        setError(getFriendlyRegisterError(authError.message));
        return;
      }

      if (data.session) {
        navigate('/dashboard', { replace: true });
        return;
      }

      setSuccess('Cadastro criado. Verifique seu e-mail para confirmar a conta.');
    } catch {
      setError('Não foi possível criar a conta. Confira sua conexão e tente novamente.');
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
            <h1>Crie sua conta</h1>
            <p>Comece a organizar seus ciclos de recompra.</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Input
            id="register-email"
            label="E-mail"
            placeholder="voce@loja.com"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            id="register-password"
            label="Senha"
            placeholder="No mínimo 6 caracteres"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
          <Input
            id="register-password-confirmation"
            label="Confirmar senha"
            placeholder="Repita a senha"
            type="password"
            autoComplete="new-password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            minLength={6}
            required
          />

          {(error || configurationError) && (
            <div className="form-message form-message-error" role="alert">
              {error ?? configurationError}
            </div>
          )}

          {success && (
            <div className="form-message form-message-success" role="status">
              {success}
            </div>
          )}

          <Button type="submit" disabled={submitting || Boolean(configurationError) || Boolean(success)}>
            {submitting ? 'Criando conta...' : 'Criar cadastro'}
          </Button>
        </form>

        <p className="auth-footer">
          Já possui uma conta? <Link className="text-link" to="/login">Entrar</Link>
        </p>
      </Card>
    </main>
  );
}
