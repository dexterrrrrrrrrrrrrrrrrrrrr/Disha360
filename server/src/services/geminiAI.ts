import { GoogleGenAI, ApiError, type GoogleGenAIOptions, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';
import { StructuredAI } from './structuredAI.js';

export const AI_UNAVAILABLE_MESSAGE = 'The AI service is temporarily unavailable or its free usage limit has been reached. Please try again later.';
export const geminiLimits = { timeoutMs: 45000, inputBytes: 85000, outputBytes: 100000, requestsPerMinute: 10, concurrentRequests: 2 } as const;
export interface GeminiSettings { primaryKey?: string; backupKey?: string; keySelection?: 'primary' | 'backup'; model: string }
export interface GeminiTransport { generateContent(params: GenerateContentParameters): Promise<Pick<GenerateContentResponse, 'text' | 'candidates' | 'promptFeedback'>> }
export type GeminiClientFactory = (options: GoogleGenAIOptions) => GeminiTransport;
// One backend client and shared limits for all Gemini features. No automatic key,
// provider or model fallbacks, tools, grounding, caches or paid resource creation.
export class GeminiAIService extends StructuredAI {
  readonly name = 'Google Gemini';
  private readonly client: GeminiTransport;
  private readonly model: string;
  private requests: number[] = [];
  private active = 0;
  constructor(settings: GeminiSettings, createClient: GeminiClientFactory = options => new GoogleGenAI(options).models) {
    super();
    const key = settings.keySelection === 'backup' ? settings.backupKey : settings.primaryKey;
    if (!key?.trim()) throw new AppError(503, 'AI_CONFIGURATION_ERROR', 'The selected Gemini credential is missing. Ask the operator to configure the backend and restart it.');
    if (!/^gemini-[a-zA-Z0-9.-]+$/.test(settings.model))
      throw new AppError(503, 'AI_CONFIGURATION_ERROR', 'Configure GEMINI_MODEL with a currently verified Free Tier model before enabling AI. No default or fallback model is selected.');
    this.model = settings.model;
    this.client = createClient({ apiKey: key, enterprise: false, vertexai: false,
      httpOptions: { timeout: geminiLimits.timeoutMs, retryOptions: { attempts: 1 } } });
  }
  protected async json<T>(instructions: string, input: unknown, schema: unknown, validate: z.ZodType<T>, maxOutputTokens: number): Promise<T> {
    const contents = JSON.stringify(input);
    if (Buffer.byteLength(contents, 'utf8') > geminiLimits.inputBytes)
      throw new AppError(413, 'AI_INPUT_TOO_LARGE', 'This AI request is too large. Shorten the supplied text and try again.');
    const now = Date.now();
    this.requests = this.requests.filter(at => now - at < 60000);
    if (this.requests.length >= geminiLimits.requestsPerMinute || this.active >= geminiLimits.concurrentRequests)
      throw new AppError(503, 'AI_LIMITED', AI_UNAVAILABLE_MESSAGE);
    this.requests.push(now); this.active++;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new AppError(503, 'AI_TIMEOUT', AI_UNAVAILABLE_MESSAGE)); }, geminiLimits.timeoutMs);
      });
      const response = await Promise.race([this.client.generateContent({ model: this.model, contents,
        config: { systemInstruction: instructions, responseMimeType: 'application/json', responseJsonSchema: schema,
          maxOutputTokens, candidateCount: 1, temperature: 0.3, abortSignal: controller.signal,
          httpOptions: { timeout: geminiLimits.timeoutMs, retryOptions: { attempts: 1 } },
        },
      }), deadline]);
      if (response.promptFeedback?.blockReason || response.candidates?.length !== 1 || response.candidates[0].finishReason !== 'STOP')
        throw new Error('Incomplete or blocked response');
      const parts = response.candidates[0].content?.parts;
      if (!parts?.length || parts.some(part => typeof part.text !== 'string' || part.functionCall || part.executableCode || part.inlineData || part.fileData || part.codeExecutionResult))
        throw new Error('Unexpected non-text content');
      const text = response.text;
      if (!text || Buffer.byteLength(text, 'utf8') > geminiLimits.outputBytes) throw new Error('Invalid response size');
      return validate.parse(JSON.parse(text));
    } catch (error) {
      if (error instanceof AppError) throw error;
      // Never log or forward raw SDK errors, which may include credentials or content.
      if (error instanceof ApiError && [400, 401, 403, 404].includes(error.status))
        throw new AppError(503, 'AI_CONFIGURATION_ERROR', 'The AI provider rejected the selected credential, model or request configuration. Ask the operator to check the backend configuration without enabling billing.');
      if (error instanceof ApiError && error.status === 429) throw new AppError(503, 'AI_LIMITED', AI_UNAVAILABLE_MESSAGE);
      throw new AppError(503, 'AI_UNAVAILABLE', AI_UNAVAILABLE_MESSAGE);
    } finally { if (timer) clearTimeout(timer); this.active--; }
  }
}
