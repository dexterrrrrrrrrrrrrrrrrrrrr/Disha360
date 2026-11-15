import { z } from 'zod';
import { categories } from './assessment.js';

export const assessmentCoachRequest = z.object({
  consent: z.literal(true),
  consentProvider: z.string().max(80),
}).strict();

export const assessmentCoachInput = z.object({
  completedAttempts: z.number().int().positive(),
  categories: z.array(z.object({
    category: z.enum(categories),
    questions: z.number().int().positive(),
    correct: z.number().int().nonnegative(),
    accuracy: z.number().min(0).max(100),
  }).strict()).min(1).max(categories.length),
}).strict();

export const assessmentPlan = z.object({
  summary: z.string().trim().min(1).max(400),
  steps: z.array(z.string().trim().min(1).max(280)).min(1).max(3),
}).strict();
export const assessmentPlanJson = {
  type: 'object',
  properties: { summary: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } } },
  required: ['summary', 'steps'], additionalProperties: false,
};
export type AssessmentCoachInput = z.infer<typeof assessmentCoachInput>;
export type AssessmentPlan = z.infer<typeof assessmentPlan>;
