import { Link, useLocation } from 'react-router-dom';

export default function Placeholder() {
  const { pathname } = useLocation();
  return (
    <div style={{ padding: 48 }}>
      <h2>{pathname}</h2>
      <p className="muted mb-24">This page hasn't been converted to React yet.</p>
      <Link to="/dashboard" className="btn btn-primary">Back to Dashboard</Link>
    </div>
  );
}
