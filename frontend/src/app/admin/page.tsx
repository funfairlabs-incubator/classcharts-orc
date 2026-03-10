'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface User { email: string; name?: string; addedBy: string; addedAt: string; }

export default function AdminPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.isAdmin;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(setUsers)
      .finally(() => setLoading(false));
  }, [isAdmin]);

  async function addUser() {
    if (!newEmail) return;
    setSaving(true); setError('');
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, name: newName }),
    });
    if (res.ok) {
      const u = await res.json();
      setUsers(prev => [...prev, u]);
      setNewEmail(''); setNewName('');
    } else {
      const d = await res.json();
      setError(d.error ?? 'Failed to add user');
    }
    setSaving(false);
  }

  async function removeUser(email: string) {
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setUsers(prev => prev.filter(u => u.email !== email));
  }

  if (!isAdmin) {
    return (
      <div style={styles.denied}>
        <h1 style={styles.pageTitle}>Access denied</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>You need admin privileges to view this page.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={styles.pageTitle}>Admin</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Manage who can access this dashboard.</p>
      </div>
      <hr style={styles.rule} />

      {/* Add user */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={styles.sectionTitle}>Add user</h2>
        <div className="card" style={{ padding: 24 }}>
          <div style={styles.addRow}>
            <input
              style={styles.input}
              type="email"
              placeholder="Gmail address"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addUser()}
            />
            <input
              style={styles.input}
              type="text"
              placeholder="Name (optional)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addUser()}
            />
            <button style={styles.addBtn} onClick={addUser} disabled={saving || !newEmail}>
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
          {error && <p style={styles.error}>{error}</p>}
        </div>
      </section>

      {/* User list */}
      <section>
        <h2 style={styles.sectionTitle}>Allowed users</h2>
        {loading ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading…</p>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {users.length === 0 && (
              <p style={{ padding: 20, fontSize: 13, color: 'var(--text-3)' }}>No users added yet.</p>
            )}
            {users.map((u, i) => (
              <div key={u.email} style={{ ...styles.userRow, borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <p style={styles.userEmail}>{u.email}</p>
                  {u.name && <p style={styles.userName}>{u.name}</p>}
                  <p style={styles.userMeta}>Added by {u.addedBy} · {new Date(u.addedAt).toLocaleDateString('en-GB')}</p>
                </div>
                <button style={styles.removeBtn} onClick={() => removeUser(u.email)}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  denied: { paddingTop: 40 },
  pageTitle: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500 },
  rule: { border: 'none', borderTop: '1px solid var(--border)', marginBottom: 40 },
  sectionTitle: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, marginBottom: 16 },
  addRow: { display: 'flex', gap: 12, alignItems: 'center' },
  input: { flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', background: 'var(--bg)' },
  addBtn: { padding: '10px 20px', background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-body)', cursor: 'pointer' },
  error: { marginTop: 8, fontSize: 13, color: 'var(--negative)' },
  userRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', gap: 16 },
  userEmail: { fontSize: 14, fontWeight: 500 },
  userName: { fontSize: 12, color: 'var(--text-2)', marginTop: 2 },
  userMeta: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginTop: 4 },
  removeBtn: { fontSize: 12, color: 'var(--negative)', background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-body)' },
};
