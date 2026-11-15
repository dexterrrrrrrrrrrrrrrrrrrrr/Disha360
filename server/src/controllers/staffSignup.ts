import { createHash, randomBytes } from 'node:crypto';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { StaffInvite } from '../models/StaffInvite.js';
import { User } from '../models/User.js';
import { hashPassword } from '../services/password.js';
import { emailSchema, passwordSchema } from '../validators/auth.js';
import { AppError } from '../utils/AppError.js';

const inviteRequest = z.object({ email: emailSchema }).strict();
const signupRequest = inviteRequest.extend({
  name: z.string().trim().min(2).max(80),
  department: z.string().trim().min(2).max(100),
  password: passwordSchema,
  inviteCode: z.string().trim().regex(/^[A-Za-z0-9_-]{32}$/),
}).strict();
const digest = (code: string) => createHash('sha256').update(code).digest('hex');
const conflict = () => new AppError(409, 'EMAIL_EXISTS', 'This email already has an account. Sign in or ask your administrator for help.');

export const issueStaffInvite: RequestHandler = async (req, res) => {
  if (req.user?.isDemo) throw new AppError(403, 'FORBIDDEN', 'Sign in with a real Admin account to invite staff.');
  const { email } = inviteRequest.parse(req.body);
  if (await User.exists({ email })) throw conflict();
  const code = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await StaffInvite.findOneAndUpdate({ email }, {
    $set: { codeHash: digest(code), expiresAt },
  }, { upsert: true, runValidators: true });
  res.status(201).json({ success: true, data: { code, expiresAt } });
};

export const registerStaff: RequestHandler = async (req, res) => {
  const { email, name, department, password, inviteCode } = signupRequest.parse(req.body);
  const filter = { email, codeHash: digest(inviteCode), expiresAt: { $gt: new Date() } };
  const invalid = () => new AppError(400, 'INVALID_STAFF_INVITE', 'This invitation is invalid or expired. Check the email and code or ask for a new invitation.');
  if (!await StaffInvite.exists(filter)) throw invalid();
  if (await User.exists({ email })) throw conflict();
  const passwordHash = await hashPassword(password);
  // Consume atomically so concurrent attempts cannot redeem a code twice.
  const invite = await StaffInvite.findOneAndDelete({ ...filter, expiresAt: { $gt: new Date() } });
  if (!invite) throw invalid();
  try {
    await User.create({ email, name, department, passwordHash, role: 'trainer' });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) throw conflict();
    throw error;
  }
  res.status(201).json({ success: true, data: { message: 'Staff account created. You can now sign in.' } });
};
