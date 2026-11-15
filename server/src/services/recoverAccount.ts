import { z } from 'zod';
import { roles, User } from '../models/User.js';
import { emailSchema, passwordSchema } from '../validators/auth.js';
import { hashPassword } from './password.js';

export const recoverySchema = z.object({ email: emailSchema, password: passwordSchema, role: z.enum(roles) }).strict();

/** Operator-only; no HTTP route and no creation or role changes. */
export async function recoverAccount(input: z.input<typeof recoverySchema>) {
  const { email, password, role } = recoverySchema.parse(input);
  const passwordHash = await hashPassword(password);
  const result = await User.updateOne({ email, role, isDemo: { $ne: true } }, {
    $set: { passwordHash }, $inc: { authVersion: 1 },
  }, { runValidators: true });
  return result.modifiedCount === 1;
}
