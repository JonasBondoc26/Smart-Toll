import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import { DeleteModal, FormModal, strongInk } from '../../components/admin/Modals.jsx';
import Icon from '../../components/Icon.jsx';

// Mockups 20, 26, 27, 34.
export default function VehicleClasses() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);   // { mode: 'add' | 'edit' | 'delete', row? }
  const [form, setForm] = useState({ class_name: '', description: '' });

  const load = () => api('/admin/vehicle-classes').then((d) => setRows(d.classes)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ class_name: '', description: '' }); setModal({ mode: 'add' }); };
  const openEdit = (row) => { setForm({ class_name: row.class_name, description: row.description }); setModal({ mode: 'edit', row }); };
  const close = () => setModal(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    if (!form.class_name.trim() || !form.description.trim()) throw new Error('Enter both the class name and its description.');
    const body = { class_name: form.class_name.trim(), description: form.description.trim() };
    if (modal.mode === 'add') await api('/admin/vehicle-classes', { method: 'POST', body });
    else await api(`/admin/vehicle-classes/${modal.row.classification_id}`, { method: 'PUT', body });
    close();
    await load();
  };

  const remove = async () => {
    await api(`/admin/vehicle-classes/${modal.row.classification_id}`, { method: 'DELETE' });
    close();
    await load();
  };

  const inUse = modal?.mode === 'delete' && (modal.row.rate_count > 0 || modal.row.vehicle_count > 0);

  return (
    <AdminLayout
      title="Vehicle Classifications" subtitle="Ensures toll fees are computed using the correct rate category."
      action={<button className="btn btn-primary" onClick={openAdd}><Icon name="plus" stroke={2.5} />Add Classification</button>}
    >
      {error && <p className="muted" style={{ color: '#B3261E' }}>{error}</p>}
      {!rows && !error && <p className="muted">Loading…</p>}

      {rows && (
        <div className="card card-flush mb-24">
          <div className="table-scroll">
            <table>
              <thead><tr><th>Class</th><th>Description</th><th>Toll Rates</th><th>Vehicles</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.classification_id}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.class_name}</td>
                    <td>{r.description}</td>
                    <td>{r.rate_count.toLocaleString()}</td>
                    <td>{r.vehicle_count}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn-text" onClick={() => openEdit(r)}>Edit</button>
                        <button className="btn-danger-text" onClick={() => setModal({ mode: 'delete', row: r })}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && modal.mode !== 'delete' && (
        <FormModal
          kicker={modal.mode === 'add' ? 'ADD CLASSIFICATION' : 'EDITING CLASSIFICATION'}
          title={modal.mode === 'add' ? 'New Classification' : modal.row.class_name}
          submitLabel={modal.mode === 'add' ? 'Save Classification' : 'Save Changes'}
          onClose={close} onSubmit={save}
        >
          <div className="field">
            <label htmlFor="c-name">Class Name</label>
            <input id="c-name" type="text" placeholder="e.g. Class 1" value={form.class_name} onChange={set('class_name')} maxLength={20} autoFocus />
            <div className="field-hint">Include the class number (e.g. "Class 2"): toll rates are looked up by it.</div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="c-desc">Description</label>
            <input id="c-desc" type="text" placeholder="e.g. Cars, jeepneys, vans, pick-ups" value={form.description} onChange={set('description')} maxLength={255} />
          </div>
        </FormModal>
      )}

      {modal?.mode === 'delete' && (
        inUse ? (
          <DeleteModal title="Delete this classification?" blocked onClose={close}>
            You're about to remove <strong style={strongInk}>{modal.row.class_name}</strong> ({modal.row.description}) from the system.
            <div className="notice notice-error mt-16">
              <strong>This deletion is blocked.</strong> {modal.row.rate_count.toLocaleString()} toll matrix entries and {modal.row.vehicle_count} registered
              vehicle{modal.row.vehicle_count === 1 ? '' : 's'} still reference this classification. Reassign or remove those first.
            </div>
            {modal.row.rate_count > 0 && (
              <button type="button" className="btn-text mt-16" style={{ margin: '12px 0 0' }}
                onClick={() => navigate(`/admin/toll-matrix?class=${modal.row.classification_id}`)}>
                Review Toll Matrix <Icon name="chevron" size={13} stroke={2.5} />
              </button>
            )}
          </DeleteModal>
        ) : (
          <DeleteModal title="Delete this classification?" confirmLabel="Yes, Delete Classification" onClose={close} onConfirm={remove}>
            You're about to remove <strong style={strongInk}>{modal.row.class_name}</strong> ({modal.row.description}). No toll rates or vehicles use it.
          </DeleteModal>
        )
      )}
    </AdminLayout>
  );
}
