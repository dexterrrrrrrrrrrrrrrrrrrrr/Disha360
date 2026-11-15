import { useRef, useState, type FormEvent } from 'react';
import { ErrorNotice } from '../../components/StudentUI';
import { staffRequest } from '../../hooks/useStaffData';

export function StaffInviteForm() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<{ email: string; code: string; expiresAt: string }>();

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const email = String(new FormData(event.currentTarget).get('staffEmail')).trim();
    pending.current = true;
    setBusy(true);
    setInvite(undefined);
    setError('');
    try {
      const created = await staffRequest<{ code: string; expiresAt: string }>('/trainer-invites', {
        method: 'POST', body: { email },
      });
      setInvite({ email, ...created });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create an invitation.');
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }

  return <section className="card mb-6 space-y-4" aria-label="Invite faculty or staff">
    <h2 className="font-semibold">Invite faculty or staff</h2>
    <p className="text-sm text-slate-600">Enter a work email you recognize. Share the invitation code directly with that person. They can use it once to create a Trainer account.</p>
    <form onSubmit={issue} className="flex flex-wrap items-end gap-3">
      <label className="min-w-56 flex-1"><span className="field-label">Work email</span>
        <input type="email" name="staffEmail" className="input" required maxLength={254} disabled={busy} />
      </label>
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Creating invitation…' : 'Create invitation'}</button>
    </form>
    {error && <ErrorNotice message={error} />}
    {invite && <div className="space-y-2 rounded-lg bg-indigo-50 p-4">
      <p role="status" className="text-sm">Invitation created for <strong>{invite.email}</strong>. Expires {new Date(invite.expiresAt).toLocaleString()}.</p>
      <label><span className="field-label">One-time invitation code</span>
        <input readOnly value={invite.code} onFocus={event => event.currentTarget.select()} className="input font-mono" />
      </label>
      <p className="text-xs text-slate-600">Have them choose “Create a staff account” on the sign-in page. Creating a new invitation for this email replaces the old code.</p>
    </div>}
  </section>;
}
