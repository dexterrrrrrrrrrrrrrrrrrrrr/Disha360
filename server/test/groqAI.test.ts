import { expect, it, vi } from 'vitest';
import { configureAI } from '../src/services/aiProvider.js';
import { envSchema } from '../src/config/env.js';
import { GroqAI, groqModel } from '../src/services/groqAI.js';
import { prepareResumeSuggestions } from '../src/validators/resumeSuggestions.js';
import { geminiAnswer, geminiFeedback, geminiSetup, geminiSuggestion } from './helpers/gemini.js';
import { resumeFixture } from './helpers/resume.js';

const response = (content: unknown, finish_reason = 'stop') => Response.json({
  choices: [{ finish_reason, message: { content: JSON.stringify(content) } }],
});
const mock = (payload: Response, limit = 25) => {
  const send = vi.fn<typeof fetch>().mockResolvedValue(payload);
  return { send, ai: new GroqAI('fixture-key', groqModel, limit, send) };
};

it('requires the selected free-model configuration and never falls back', () => {
  const settings = envSchema.parse({ AI_PROVIDER: 'groq', GROQ_MODEL: groqModel });
  expect(configureAI(settings).provider).toBeUndefined();
  expect(configureAI({ ...settings, GROQ_API_KEY: 'fixture', GROQ_MODEL: 'unexpected' }).provider).toBeUndefined();
  expect(configureAI({ ...settings, GROQ_API_KEY: 'fixture' }).provider?.name).toBe('GroqCloud');
});

it('uses the fixed Groq endpoint and limits quota across operations without another request', async () => {
  const { ai, send } = mock(response({ question: 'How would you approach that problem?' }), 1);
  await expect(ai.question(geminiSetup, [])).resolves.toMatch(/approach/);
  const [url, request] = send.mock.calls[0];
  expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
  expect(request).toMatchObject({ redirect: 'error', headers: { Authorization: 'Bearer fixture-key' } });
  const payload = JSON.parse(String(request?.body));
  expect(payload).toMatchObject({ model: groqModel, stream: false, max_completion_tokens: 1200,
    response_format: { type: 'json_object' } });
  expect(payload.tools).toBeUndefined();
  await expect(ai.resumeSuggestions(prepareResumeSuggestions(resumeFixture().content, 'x'.repeat(60))))
    .rejects.toMatchObject({ code: 'AI_LIMITED' });
  expect(send).toHaveBeenCalledTimes(1);
});

it('validates interview feedback, resume suggestions and coding mentor output', async () => {
  const feedback = geminiFeedback();
  await expect(mock(response(feedback)).ai.feedback(geminiSetup, [
    { role: 'interviewer', text: 'Explain your project.', at: new Date() },
    { role: 'student', text: geminiAnswer, at: new Date() },
  ])).resolves.toEqual(feedback);
  await expect(mock(response(geminiSuggestion)).ai.resumeSuggestions(
    prepareResumeSuggestions(resumeFixture().content, 'x'.repeat(60)),
  )).resolves.toEqual(geminiSuggestion);
  const mentor = { explanation: 'Start by tracing the loop.', nextSteps: ['Try a small input.'] };
  await expect(mock(response(mentor)).ai.codingMentor({
    language: 'python', source: 'print(1)', problem: null, action: 'hint', hintLevel: 1,
    allowSolution: false, error: '', prompt: '',
  })).resolves.toEqual(mentor);
});

it.each([[401, 'AI_CONFIGURATION_ERROR'], [429, 'AI_LIMITED']] as const)('sanitizes status %s', async (status, code) => {
  const { ai, send } = mock(new Response('private credential provider detail', { status }));
  await expect(ai.question(geminiSetup, [])).rejects.toMatchObject({ code });
  expect(send).toHaveBeenCalledTimes(1);
});

it('fails closed on truncated or invalid provider output', async () => {
  await expect(mock(response({ question: 'Incomplete question text?' }, 'length')).ai.question(geminiSetup, []))
    .rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  await expect(mock(response({ question: 42 })).ai.question(geminiSetup, []))
    .rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
});
