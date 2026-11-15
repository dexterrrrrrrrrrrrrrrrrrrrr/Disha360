import type { z } from 'zod';
import { AppError } from '../utils/AppError.js';
import { StructuredAI } from './structuredAI.js';
import { limitedText } from './limitedResponse.js';
import { assessmentCoachInput, assessmentPlan, assessmentPlanJson, type AssessmentCoachInput } from '../validators/assessmentCoach.js';

const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
export const groqModel = 'openai/gpt-oss-20b';
const unavailable = 'GroqCloud is unavailable or its free quota has been reached. Please try again later.';
export class GroqAI extends StructuredAI {
  readonly name = 'GroqCloud';
  private active = false;
  private requests: number[] = [];
  constructor(private readonly key: string, private readonly model: string,
    private readonly dailyLimit: number, private readonly send: typeof fetch = fetch) {
    super();
  }
  async assessmentCoach(input: AssessmentCoachInput) {
    return this.json(
      'Use these aggregate results to suggest a short study plan. Give a brief summary and one to three specific practice steps. Acknowledge limited evidence for small samples. Do not invent topics, diagnose abilities, calculate a new grade, or claim that any score changed.',
      assessmentCoachInput.parse(input), assessmentPlanJson, assessmentPlan, 650,
    );
  }
  protected async json<T>(instructions: string, input: unknown, schema: unknown,
    validate: z.ZodType<T>, maxOutputTokens: number): Promise<T> {
    const content = JSON.stringify(input);
    const system = `${instructions}\nReturn exactly one JSON object matching this schema: ${JSON.stringify(schema)}`;
    if (Buffer.byteLength(content) > 12000)
      throw new AppError(413, 'AI_INPUT_TOO_LARGE', 'Shorten the text before sending it to the AI service.');
    const now = Date.now();
    this.requests = this.requests.filter(at => now - at < 86400000);
    if (this.active || this.requests.length >= this.dailyLimit || this.requests.filter(at => now - at < 60000).length >= 3)
      throw new AppError(503, 'AI_LIMITED', unavailable);
    this.active = true;
    this.requests.push(now);
    try {
      const response = await this.send(endpoint, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, reasoning_effort: 'low', stream: false,
          max_completion_tokens: Math.min(maxOutputTokens + 600, 3000),
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: system }, { role: 'user', content }] }),
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        if (response.status === 429) throw new AppError(503, 'AI_LIMITED', unavailable);
        if ([400, 401, 403, 404].includes(response.status))
          throw new AppError(503, 'AI_CONFIGURATION_ERROR', 'GroqCloud rejected the request. Check the backend key and model access.');
        throw new Error('GroqCloud request failed');
      }
      const text = await limitedText(response, 100000);
      const answer = JSON.parse(text);
      const choice = answer.choices?.[0];
      if (answer.choices?.length !== 1 || choice?.finish_reason !== 'stop' ||
        typeof choice.message?.content !== 'string' || choice.message?.tool_calls?.length)
        throw new Error('Incomplete GroqCloud response');
      return validate.parse(JSON.parse(choice.message.content));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(503, 'AI_UNAVAILABLE', unavailable);
    } finally {
      this.active = false;
    }
  }
}
