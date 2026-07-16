import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../UI/Button';
import { useAuth } from '../../features/auth/useAuth';

export function Header() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      console.error('Não foi possível encerrar a sessão no Supabase.', error);
    } finally {
      navigate('/login', { replace: true });
    }
  }

  return (
    <header className="app-header">
      <div className="app-header-copy">
        <strong>Sistema de Recompra por WhatsApp</strong>
        <span>{user?.email ?? 'Operação manual para relacionamento de recompra'}</span>
      </div>
      <Button type="button" variant="ghost" className="logout-button" onClick={handleSignOut}>
        <LogOut size={18} aria-hidden="true" />
        Sair
      </Button>
    </header>
  );
}
