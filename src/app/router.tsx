import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/Layout/AppLayout';
import { ProtectedRoute, PublicRoute } from '../features/auth/ProtectedRoute';
import { AuthCallbackPage } from '../features/auth/AuthCallbackPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { CustomersPage } from '../features/customers/CustomersPage';
import { CustomerHistoryPage } from '../features/customers/CustomerHistoryPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ImportCsvPage } from '../features/importCsv/ImportCsvPage';
import { NewPurchasePage } from '../features/purchases/NewPurchasePage';
import { PurchasesPage } from '../features/purchases/PurchasesPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { TodayContactsPage } from '../features/todayContacts/TodayContactsPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicRoute>
        <RegisterPage />
      </PublicRoute>
    ),
  },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'compras', element: <PurchasesPage /> },
      { path: 'compras/nova', element: <NewPurchasePage /> },
      { path: 'contatos-hoje', element: <TodayContactsPage /> },
      { path: 'clientes', element: <CustomersPage /> },
      { path: 'clientes/:id', element: <CustomerHistoryPage /> },
      { path: 'importar-csv', element: <ImportCsvPage /> },
      { path: 'configuracoes', element: <SettingsPage /> },
    ],
  },
]);
