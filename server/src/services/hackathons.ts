import { z } from 'zod';
import { AppError } from '../utils/AppError.js';
import { limitedText } from './limitedResponse.js';

const feedUrl = 'https://hackathons.hackclub.com/api/events/all/';
const record = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  website: z.string().max(2048).nullish(),
  city: z.string().max(120).nullish(),
  country: z.string().max(120).nullish(),
  virtual: z.boolean().optional(),
  hybrid: z.boolean().optional(),
});

function publicLink(value?: string | null) {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function normalize(input: unknown) {
  const result = record.safeParse(input);
  if (!result.success) return [];
  const { id, name, start, end, website, city, country, virtual, hybrid } = result.data;
  const begins = Date.parse(start), finishes = Date.parse(end);
  if (!Number.isFinite(begins) || !Number.isFinite(finishes) || finishes < begins) return [];
  return [{ id, name, start: new Date(begins).toISOString(), end: new Date(finishes).toISOString(),
    url: publicLink(website), location: [city, country].filter(Boolean).join(', '),
    format: hybrid ? 'Hybrid' as const : virtual ? 'Online' as const : 'In person' as const }];
}

export function createHackathonFeed(send: typeof fetch = fetch, clock = Date.now) {
  let snapshot: { syncedAt: number; events: ReturnType<typeof normalize> } | undefined;
  let running: Promise<void> | undefined;
  let retryAt = 0;
  let stale = false;
  async function sync() {
    const res = await send(feedUrl, {
      redirect: 'error', signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw new Error('Feed unavailable');
    }
    const payload: unknown = JSON.parse(await limitedText(res, 2_000_000));
    if (!Array.isArray(payload)) throw new Error('Invalid feed');
    const events = payload.flatMap(normalize);
    if (payload.length && !events.length) throw new Error('Invalid event feed rows');
    snapshot = { syncedAt: clock(), events: [...new Map(events.map(event => [event.id, event])).values()] };
    stale = false;
  }
  return async () => {
    const now = clock();
    if ((!snapshot || now - snapshot.syncedAt >= 3600000) && now >= retryAt) {
      running ??= sync().catch(() => { stale = true; retryAt = clock() + 300000; })
        .finally(() => { running = undefined; });
      await running;
    }
    if (!snapshot || clock() - snapshot.syncedAt > 86400000)
      throw new AppError(503, 'HACKATHON_FEED_UNAVAILABLE', 'The hackathon listing is temporarily unavailable. Please try again later.');
    const asOf = clock();
    return {
      syncedAt: new Date(snapshot.syncedAt).toISOString(),
      stale,
      events: snapshot.events.filter(event => Date.parse(event.end) > asOf)
        .sort((a, b) => a.start.localeCompare(b.start))
        .map(event => ({ ...event, status: Date.parse(event.start) <= asOf ? 'Live' as const : 'Upcoming' as const })),
    };
  };
}
