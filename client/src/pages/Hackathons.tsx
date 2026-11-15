import { useEffect, useState } from 'react';
import { Empty, ErrorNotice, Loading, PageHeading } from '../components/StudentUI';
import { useStaffData } from '../hooks/useStaffData';
import { AppLayout } from '../layouts/AppLayout';

type Feed = { syncedAt: string; stale: boolean; events: {
  id: string; name: string; start: string; end: string; url: string | null; location: string;
  format: 'Online' | 'Hybrid' | 'In person'; status: 'Live' | 'Upcoming';
}[] };
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function Hackathons() {
  const { data, loading, error, reload } = useStaffData<Feed>('/hackathons', '/api/v1');
  const [filter, setFilter] = useState('All');
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, 300000);
    return () => window.clearInterval(timer);
  }, [reload]);
  const events = data?.events.filter(event => filter === 'All' || event.status === filter || event.format === filter);
  return <AppLayout role="student">
    <PageHeading title="Hackathons" detail="Find events happening now or coming up. Check the organizer’s site for eligibility and registration." />
    <div className="card mb-5 flex flex-wrap items-end justify-between gap-4">
      <label><span className="field-label">Show events</span>
        <select className="input" value={filter} onChange={event => setFilter(event.target.value)}>
          {['All', 'Live', 'Upcoming', 'Online', 'Hybrid', 'In person'].map(value => <option key={value}>{value}</option>)}
        </select>
      </label>
      <p className="text-sm text-slate-600">
        Listings from <a className="font-semibold text-brand underline" href="https://hackathons.hackclub.com/" target="_blank" rel="noopener noreferrer">Hack Club Hackathons</a>
        {data && <> · Last synced {dateTime.format(new Date(data.syncedAt))}</>}
      </p>
    </div>
    {data?.stale && <p role="status" className="card mb-5 text-sm">The source is temporarily unavailable. Showing the last successful sync.</p>}
    {error ? <ErrorNotice message={error} retry={() => void reload()} /> : loading && !data ? <Loading /> : !events?.length ?
      <Empty message="No events match this filter right now." /> : <div className="grid gap-5 md:grid-cols-2">
        {events.map(event => <section key={event.id} className="card min-w-0 space-y-3">
          <p className="text-sm font-semibold text-brand">{event.status} · {event.format}</p>
          <h2 className="break-words text-lg font-semibold">{event.name}</h2>
          {event.location && <p className="text-sm">{event.location}</p>}
          <p className="text-sm text-slate-600">
            <time dateTime={event.start}>{dateTime.format(new Date(event.start))}</time> – <time dateTime={event.end}>{dateTime.format(new Date(event.end))}</time>
          </p>
          {event.url && <a className="btn-secondary inline-block" href={event.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Organizer website ↗</a>}
        </section>)}
      </div>}
  </AppLayout>;
}
