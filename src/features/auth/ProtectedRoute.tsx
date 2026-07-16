import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loading } from '../../components/UI/Loading';
import { useAuth } from './useAuth';

type ProtectedRouteProps = {
  children: ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <main className="route-loading">
        <Loading />
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function PublicRoute({ children }: ProtectedRouteProps) {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <main className="route-loading">
        <Loading />
      </main>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
