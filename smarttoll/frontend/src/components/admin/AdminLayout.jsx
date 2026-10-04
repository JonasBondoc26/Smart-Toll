import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../AuthContext.jsx';
import Sidebar from '../Sidebar.jsx';
import Icon from '../Icon.jsx';

const NAV = [
  ['/admin/dashboard', 'grid', 'Home'], ['/admin/expressways', 'road', 'Express'], ['/admin/toll-plazas', 'plaza', 'Plazas'],
  ['/admin/vehicle-classes', 'classes', 'Classes'], ['/admin/toll-matrix', 'table', 'Matrix'], ['/admin/profile', 'user', 'Profile'],
];

export const initialsOf = (name) => name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// Shell shared by every admin page (mockups 16-37): dark top bar with the "Admin" tag,
// the admin sidebar on wider screens and the admin bottom tab bar on phones.
export default function AdminLayout({ title, subtitle, action, children }) {
  const { user } = useAuth();
  return (
    <>
      <div className="topbar admin-bar">
        <div className="brand"><span className="mark"><Icon name="menu" size={18} stroke={2.5} /></span>SmartToll <span className="brand-tag">Admin</span></div>
        <Link to="/admin/profile" className="topbar-user" style={{ textDecoration: 'none', color: 'inherit' }}>
          {user.name} <div className="avatar admin">{initialsOf(user.name)}</div>
        </Link>
      </div>

      <div className="app-shell">
        <Sidebar admin />
        <div className="main">
          <div className="page-head">
            <div>
              <h1>{title}</h1>
              {subtitle && <div className="subtitle">{subtitle}</div>}
            </div>
            {action}
          </div>
          {children}
        </div>
      </div>

      <nav className="bottom-nav admin-bn">
        {NAV.map(([to, icon, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `bn-item${isActive ? ' active' : ''}${label === 'Profile' ? ' bn-more' : ''}`}>
            <Icon name={icon} size={21} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
