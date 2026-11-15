import { expect, it, vi } from 'vitest';
import { createHackathonFeed } from '../src/services/hackathons.js';

const event = (id: string, start: string, end: string, website = 'https://example.test/event') => ({
  id, name: 'Hack ' + id, start, end, website, hybrid: true,
});
const now = Date.parse('2026-11-15T00:00:00.000Z');
const upcoming = event('one', '2026-11-16T00:00:00.000Z', '2026-11-17T00:00:00.000Z', 'javascript:alert(1)');
const live = event('two', '2026-11-14T00:00:00.000Z', '2026-11-15T01:00:00.000Z');

it('deduplicates upcoming and live events, drops ended events and never publishes unsafe links', async () => {
  const send = vi.fn<typeof fetch>().mockImplementation(async () => Response.json([upcoming, live, live,
    event('ended', '2026-11-10T00:00:00.000Z', '2026-11-11T00:00:00.000Z'), { invalid: true }]));
  const feed = createHackathonFeed(send, () => now);
  const [a, b] = await Promise.all([feed(), feed()]);
  expect(a).toEqual(b);
  expect(send).toHaveBeenCalledTimes(1);
  expect(a.events.map(({ id, status, url }) => ({ id, status, url }))).toEqual([
    { id: 'two', status: 'Live', url: 'https://example.test/event' },
    { id: 'one', status: 'Upcoming', url: null },
  ]);
});

it('keeps last good data on temporary upstream failure and retries after a cooldown', async () => {
  let clock = now;
  const send = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json([upcoming]))
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json([]));
  const feed = createHackathonFeed(send, () => clock);
  expect((await feed()).stale).toBe(false);
  clock += 3600000;
  expect(await feed()).toMatchObject({ stale: true, events: [{ id: 'one' }] });
  await feed();
  expect(send).toHaveBeenCalledTimes(2);
  clock += 300000;
  expect(await feed()).toMatchObject({ stale: false, events: [] });
});
