import { Navigate } from 'react-router-dom';
import { Loading } from '../../components/UI/Loading';
import { useAuth } from './useAuth';

export function AuthCallbackPage() {
  const { loading, user } = useAuth();

  if (!loading) {
    return <Navigate to={user ? '/dashboard' : '/login'} replace />;
  }

  return (
    <main className="route-loading">
      <Loading />
    </main>
  );
}
