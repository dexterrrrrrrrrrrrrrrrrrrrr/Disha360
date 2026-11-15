import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import request from 'supertest';
import { StaffInvite } from '../src/models/StaffInvite.js';
import { User } from '../src/models/User.js';
import { studentAccount, testApp, testDatabase } from './helpers/student.js';

let db: Awaited<ReturnType<typeof testDatabase>>;
beforeAll(async () => { db = await testDatabase(); }, 180000);
beforeEach(async () => { await db.clear(); });
afterAll(async () => { if (db) await db.close(); });

const post = (app: ReturnType<typeof testApp>, path: string, body: object, cookie = '') =>
  request(app).post(`/api/v1/${path}`).set('X-Disha360-Request', '1')
    .set('Origin', 'http://localhost:5173').set('Cookie', cookie).send(body);
const signup = 'auth/register/staff';
const issue = 'staff/trainer-invites';
const person = { email: 'faculty@example.test', name: 'Test Faculty', department: 'Computer Science', password: 'FixturePassword123!' };

it('lets only administrators invite; binds the code to its email and creates exactly one Trainer under concurrent redemption', async () => {
  const app = testApp();
  const [admin, trainer, student] = await Promise.all([studentAccount('admin'), studentAccount('trainer'), studentAccount()]);
  for (const who of [trainer, student]) expect((await post(app, issue, { email: person.email }, who.cookie)).status).toBe(403);
  expect((await post(app, issue, { email: person.email })).status).toBe(401);
  const invited = await post(app, issue, { email: person.email.toUpperCase() }, admin.cookie);
  expect(invited.status).toBe(201);
  const inviteCode = invited.body.data.code as string;
  expect(invited.headers['cache-control']).toBe('no-store');
  expect((await StaffInvite.findOne({ email: person.email }).select('+codeHash'))?.codeHash).not.toBe(inviteCode);
  expect((await post(app, signup, { ...person, email: 'other@example.test', inviteCode })).status).toBe(400);
  expect((await post(app, signup, { ...person, role: 'admin', inviteCode })).status).toBe(400);
  const results = await Promise.all([post(app, signup, { ...person, inviteCode }), post(app, signup, { ...person, inviteCode })]);
  expect(results.filter(r => r.status === 201)).toHaveLength(1);
  expect([400, 409]).toContain(results.find(r => r.status !== 201)?.status);
  expect(results.find(r => r.status === 201)?.headers['set-cookie']).toBeUndefined();
  expect(await User.countDocuments({ email: person.email })).toBe(1);
  const login = await post(app, 'auth/login', { email: person.email, password: person.password });
  expect(login.status).toBe(200);
  expect(login.body.data.user).toMatchObject({ role: 'trainer', department: 'Computer Science', semester: null });
  expect(await StaffInvite.exists({ email: person.email })).toBeNull();
  expect((await post(app, issue, { email: person.email }, admin.cookie)).status).toBe(409);
});

it('invalidates an old code when replaced and refuses expired invitations even before TTL cleanup', async () => {
  const admin = await studentAccount('admin');
  const app = testApp();
  const older = await post(app, issue, { email: person.email }, admin.cookie);
  const newer = await post(app, issue, { email: person.email }, admin.cookie);
  expect(newer.status).toBe(201);
  expect(newer.body.data.code).not.toBe(older.body.data.code);
  expect((await post(app, signup, { ...person, inviteCode: older.body.data.code })).status).toBe(400);
  await StaffInvite.updateOne({ email: person.email }, { expiresAt: new Date(Date.now() - 5000) });
  expect((await post(app, signup, { ...person, inviteCode: newer.body.data.code })).status).toBe(400);
  expect(await User.exists({ email: person.email })).toBeNull();
});
