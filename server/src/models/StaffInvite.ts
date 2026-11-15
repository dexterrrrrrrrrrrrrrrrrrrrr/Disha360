import mongoose, { Schema } from 'mongoose';

const schema = new Schema({
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true },
  codeHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
}, { autoCreate: false, autoIndex: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const StaffInvite = mongoose.model('StaffInvite', schema);
