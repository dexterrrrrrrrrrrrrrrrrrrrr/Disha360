import type { RequestHandler } from 'express';
import { assessmentMetrics, batchComparisons } from '../services/assessmentAnalytics.js';
import type { InterviewProvider } from '../services/interviewProvider.js';
import { assessmentCoachInput, assessmentCoachRequest, assessmentPlan } from '../validators/assessmentCoach.js';
import { AppError } from '../utils/AppError.js';

export function analyticsControllers(provider?: InterviewProvider) {
  const overview: RequestHandler = async (req, res) => {
    const studentId = req.user!.id as string;
    const { attempts, analytics } = await assessmentMetrics(studentId);
    res.json({ success: true, data: {
      ...analytics, coachProvider: provider?.assessmentCoach ? provider.name : null,
      batch: await batchComparisons(studentId, attempts),
    } });
  };
  const coach: RequestHandler = async (req, res) => {
    const input = assessmentCoachRequest.parse(req.body);
    if (!provider?.assessmentCoach)
      throw new AppError(503, 'AI_SETUP_REQUIRED', 'AI study plans need a configured GroqCloud provider.');
    if (input.consentProvider !== provider.name)
      throw new AppError(409, 'AI_CONSENT_REQUIRED', 'Reload and review the current AI provider before requesting a study plan.');
    const { analytics } = await assessmentMetrics(req.user!.id as string);
    if (!analytics.overview.completedAttempts || !analytics.categories.length)
      throw new AppError(422, 'NO_ASSESSMENT_RESULTS', 'Finish an assessment before requesting an AI study plan.');
    const summary = assessmentCoachInput.parse({
      completedAttempts: analytics.overview.completedAttempts,
      categories: analytics.categories.map(({ category, questions, correct, accuracy }) => ({ category, questions, correct, accuracy })),
    });
    const plan = assessmentPlan.parse(await provider.assessmentCoach(summary));
    res.json({ success: true, data: { ...plan, provider: provider.name } });
  };
  return { overview, coach };
}
