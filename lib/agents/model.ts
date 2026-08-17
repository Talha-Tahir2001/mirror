import { ChatOpenAI } from '@langchain/openai';
import type { BaseMessageLike } from '@langchain/core/messages';
import { z } from 'zod';

const DEFAULT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';

// OPENAI_BASE_URL is sometimes configured with the full `/chat/completions`
// endpoint (e.g. OpenRouter). ChatOpenAI appends `/chat/completions` itself,
// so normalize it down to the bare base here or every call 404s with
// MODEL_NOT_FOUND.
function normalizeBaseUrl(): string | undefined {
    const raw = process.env.OPENAI_BASE_URL;
    if (!raw) return undefined;
    return raw.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '');
}

/**
 * Shared OpenAI-compatible model for the agent nodes (stylist, synthesis).
 * Configured via OPENAI_API_KEY / OPENAI_BASE_URL, model via STYLIST_MODEL.
 */
export function getChatModel(temperature = 0.3): ChatOpenAI {
    const baseURL = normalizeBaseUrl();
    return new ChatOpenAI({
        model: process.env.STYLIST_MODEL ?? DEFAULT_MODEL,
        apiKey: process.env.OPENAI_API_KEY,
        configuration: baseURL ? { baseURL } : undefined,
        temperature,
    });
}

type ChatMessage = BaseMessageLike;

function toText(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map((block) => (block as { text?: string }).text ?? '')
            .join('');
    }
    return JSON.stringify(content);
}

function extractJson(raw: string): string {
    return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

async function invokeJsonText(
    messages: ChatMessage[],
    temperature: number,
): Promise<string> {
    const model = getChatModel(temperature);

    try {
        const res = await model.invoke(messages, {
            outputVersion: 'v0',
            response_format: { type: 'json_object' },
        });
        return toText(res.content);
    } catch (err) {
        // JSON mode isn't supported by every OpenAI-compatible provider —
        // retry once without it. The prompt already demands a bare JSON object.
        console.warn('json_object rejected, retrying without response_format:', (err as Error).message);
        const res = await model.invoke(messages, { outputVersion: 'v0' });
        return toText(res.content);
    }
}

/**
 * Structured output via JSON mode instead of LangChain's
 * `withStructuredOutput`, which auto-picks `jsonSchema` for non-OpenAI models
 * and breaks on providers (e.g. OpenRouter) that ignore a `json_schema`
 * response_format. We parse the raw text ourselves, so behaviour is the same
 * across providers.
 */
export async function invokeStructured<T extends z.ZodType>(
    messages: ChatMessage[],
    schema: T,
    temperature = 0.3,
): Promise<z.infer<T>> {
    const rawText = await invokeJsonText(messages, temperature);
    return schema.parse(JSON.parse(extractJson(rawText)));
}
