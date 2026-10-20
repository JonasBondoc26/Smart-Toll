export default function Field({ label, error, hint, ...inputProps }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input {...inputProps} />
      {error && <div className="field-hint" style={{ color: 'var(--error)' }}>{error}</div>}
      {hint}
    </div>
  );
}
