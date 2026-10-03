import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';
import LogoutModal from './LogoutModal.jsx';

// Desktop/tablet left nav — replaces the bottom tab bar above the 480px breakpoint.
// (The mockups only ever built the mobile bottom-nav; the CSS's .sidebar rules
// were never given matching markup, so nav disappeared on wider screens.)
const ITEMS = [
  ['/dashboard', 'grid', 'Dashboard'],
  ['/vehicles', 'car', 'Vehicles'],
  ['/rfid', 'card', 'RFID Accounts'],
  ['/trip-planner', 'pin', 'Plan a Trip'],
  ['/trip-history', 'clock', 'Trip History'],
];
const ADMIN_ITEMS = [
  ['/admin/dashboard', 'grid', 'Dashboard'],
  ['/admin/expressways', 'road', 'Expressways'],
  ['/admin/toll-plazas', 'plaza', 'Toll Plazas'],
  ['/admin/vehicle-classes', 'classes', 'Vehicle Classes'],
  ['/admin/toll-matrix', 'table', 'Toll Matrix'],
];

export default function Sidebar({ admin = false }) {
  const [confirming, setConfirming] = useState(false);
  const items = admin ? ADMIN_ITEMS : ITEMS;
  const linkStyle = {
    display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px',
    color: 'var(--ink-soft)', textDecoration: 'none', fontSize: 14, fontWeight: 500,
    borderRadius: 'var(--radius-sm)', width: '100%', border: 'none', background: 'none', cursor: 'pointer',
  };
  return (
    <div className="sidebar">
      <div className="sidebar-label">{admin ? 'Admin' : 'Account'}</div>
      {items.map(([to, icon, label]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name={icon} size={18} /><span className="sidebar-item-label">{label}</span>
        </NavLink>
      ))}
      <div className="divider" />
      <NavLink to={admin ? '/admin/profile' : '/profile'} className={({ isActive }) => (isActive ? 'active' : '')}>
        <Icon name="user" size={18} /><span className="sidebar-item-label">Profile</span>
      </NavLink>
      <button style={linkStyle} onClick={() => setConfirming(true)}>
        <Icon name="logout" size={18} /><span className="sidebar-item-label">Log out</span>
      </button>
      {confirming && <LogoutModal onClose={() => setConfirming(false)} />}
    </div>
  );
}