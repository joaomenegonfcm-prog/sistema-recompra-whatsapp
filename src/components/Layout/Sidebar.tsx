import { BarChart3, CalendarCheck, FileUp, Settings, ShoppingBag, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/contatos-hoje', label: 'Contatos de Hoje', icon: CalendarCheck },
  { to: '/compras', label: 'Compras', icon: ShoppingBag },
  { to: '/importar-csv', label: 'Importar CSV', icon: FileUp },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">SR</span>
        <div>
          <strong>Recompra</strong>
          <span>WhatsApp manual</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Navegação principal">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => clsx('sidebar-link', isActive && 'sidebar-link-active')}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
