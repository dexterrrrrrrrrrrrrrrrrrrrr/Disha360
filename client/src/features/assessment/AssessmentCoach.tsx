import { useId, useRef, useState } from 'react';
import { ErrorNotice } from '../../components/StudentUI';
import { studentRequest } from '../../services/student';

interface Plan { summary: string; steps: string[]; provider: string }

export function AssessmentCoach({ provider }: { provider: string | null }) {
  const privacy = useId();
  const pending = useRef(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  async function generate() {
    if (!provider || !consent || pending.current) return;
    pending.current = true;
    setConsent(false);
    setBusy(true);
    setError('');
    try {
      setPlan(await studentRequest<Plan>('/analytics/coach', {
        method: 'POST', body: { consent: true, consentProvider: provider },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a study plan.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return <section className="card mb-6 space-y-3" aria-label="AI study plan" aria-busy={busy}>
    <h2 className="font-semibold">AI study plan</h2>
    {provider ? <>
      <p id={privacy} className="text-sm text-slate-600">Ask {provider} what to practice next. Only your completed attempt count and summary scores by category are shared. Questions, answers, personal details and classmates’ results stay private. Your grades stay the same.</p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={consent} disabled={busy} aria-describedby={privacy} onChange={event => setConsent(event.target.checked)} />
        <span>I agree to share this summary with {provider} for this request.</span>
      </label>
      <button type="button" className="btn-primary" disabled={!consent || busy} onClick={() => void generate()}>
        {busy ? 'Creating study plan…' : 'Get study plan'}
      </button>
      {error && <ErrorNotice message={error} />}
      {plan && <div className="space-y-2 text-sm" role="status">
        <p className="font-semibold">Practice suggestions from {plan.provider}</p>
        <p className="break-words">{plan.summary}</p>
        <ol className="list-decimal space-y-1 break-words pl-5">{plan.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
      </div>}
    </> : <p className="text-sm text-slate-600">The AI study plan is unavailable until GroqCloud is configured. Your assessment results are below.</p>}
  </section>;
}
