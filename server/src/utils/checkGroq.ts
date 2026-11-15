import { env } from '../config/env.js';
import { groqModel } from '../services/groqAI.js';
import { limitedText } from '../services/limitedResponse.js';

try {
  if (env.AI_PROVIDER !== 'groq' || !env.GROQ_API_KEY || env.GROQ_MODEL !== groqModel)
    throw new Error('GroqCloud backend configuration is incomplete.');
  const reply = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!reply.ok) {
    await reply.body?.cancel().catch(() => {});
    console.error(`GroqCloud model check failed (HTTP ${reply.status}).`);
    process.exitCode = 1;
  } else {
    const models: { data?: { id?: string }[] } = JSON.parse(await limitedText(reply, 250000));
    if (!Array.isArray(models.data) || !models.data.some(model => model.id === groqModel))
      throw new Error('The configured GroqCloud model is not available to this account.');
    console.log('The configured GroqCloud model is listed for this key. No completion was requested.');
  }
} catch {
  console.error('GroqCloud model access was not verified. Check the backend settings and connectivity. No credentials were logged.');
  process.exitCode = 1;
}
