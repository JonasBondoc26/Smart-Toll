export default function Field({ label, error, hint, ...inputProps }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input {...inputProps} />
      {error && <div className="field-hint" style={{ color: '#B3261E' }}>{error}</div>}
      {hint}
    </div>
  );
}
