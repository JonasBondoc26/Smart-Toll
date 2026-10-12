import Brand from './Brand.jsx';

// Shared two-column shell for Log In / Register / Forgot Password / Admin Log In.
export default function AuthLayout({ visual, visualStyle, admin = false, children }) {
  return (
    <div className="auth-shell">
      <div className="auth-visual" style={visualStyle}>
        <Brand admin={admin} style={{ marginBottom: 48, position: 'relative' }} />
        {visual}
      </div>
      <div className="auth-form-side">
        <div className="auth-box">{children}</div>
      </div>
    </div>
  );
}

export const Headline = ({ size = 42, children }) => (
  <h1 style={{ fontSize: size, color: 'var(--white)', lineHeight: 1.15, marginBottom: 16, position: 'relative' }}>{children}</h1>
);

export const Lead = ({ maxWidth = 340, children }) => (
  <p className="muted" style={{ color: '#A9CDBB', fontSize: 15, maxWidth, position: 'relative' }}>{children}</p>
);

export const linkStyle = { color: 'var(--green-deep)', fontWeight: 600, textDecoration: 'none' };
