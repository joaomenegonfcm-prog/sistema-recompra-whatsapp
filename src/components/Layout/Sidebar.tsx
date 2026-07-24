import { useState } from 'react';
import { BarChart3, CalendarCheck, FileUp, Menu, Settings, ShoppingBag, Users } from 'lucide-react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <span className="brand-mark">SR</span>
          <div>
            <strong>Recompra</strong>
            <span>WhatsApp manual</span>
          </div>
        </div>

        <button
          type="button"
          className="sidebar-menu-button"
          aria-label={isMobileMenuOpen ? 'Fechar navegação principal' : 'Abrir navegação principal'}
          aria-expanded={isMobileMenuOpen}
          aria-controls="primary-navigation"
          onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
        >
          <Menu size={18} aria-hidden="true" />
          Menu
        </button>
      </div>

      <nav
        id="primary-navigation"
        className={clsx('sidebar-nav', isMobileMenuOpen && 'sidebar-nav-open')}
        aria-label="Navegação principal"
      >
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => clsx('sidebar-link', isActive && 'sidebar-link-active')}
              onClick={() => setIsMobileMenuOpen(false)}
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
