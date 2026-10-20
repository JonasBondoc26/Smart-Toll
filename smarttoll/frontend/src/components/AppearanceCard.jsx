import Icon from './Icon.jsx';
import { useTheme } from '../theme.js';

// Light, Dark, or follow the device's own setting, as in the mobile app (Account → Appearance).
const OPTIONS = [
  { key: 'light', label: 'Light', icon: 'sun' },
  { key: 'dark', label: 'Dark', icon: 'moon' },
  { key: 'system', label: 'System', icon: 'monitor' },
];

export default function AppearanceCard({ className = '' }) {
  const theme = useTheme();
  return (
    <div className={`card ${className}`}>
      <h3 style={{ fontSize: 15, marginBottom: 14 }}>Appearance</h3>
      <div className="appearance-options" role="radiogroup" aria-label="Appearance">
        {OPTIONS.map((o) => {
          const on = theme.preference === o.key;
          return (
            <button key={o.key} type="button" role="radio" aria-checked={on}
              className={`appearance-option${on ? ' is-on' : ''}`} onClick={() => theme.setPreference(o.key)}>
              <Icon name={o.icon} size={20} />
              {o.label}
            </button>
          );
        })}
      </div>
      <div className="field-hint" style={{ marginTop: 10 }}>
        {theme.preference === 'system'
          ? `Follows your device's setting (now ${theme.dark ? 'dark' : 'light'}).`
          : `Always ${theme.preference}. Remembered in this browser.`}
      </div>
    </div>
  );
}
