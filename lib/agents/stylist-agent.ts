import { z } from 'zod';
import { invokeStructured } from './model';
import type { garments } from '@/db/schema';
import type { ParsedOccasion } from './planner';

type Garment = typeof garments.$inferSelect;

const StylistOutputSchema = z.object({
    selections: z
        .array(
            z.object({
                garmentId: z.string().describe('Must exactly match one of the provided garment ids'),
                reason: z
                    .string()
                    .describe('One short sentence on why this fits the occasion — shown directly to the user'),
            }),
        )
        .min(1)
        .max(4),
});

export type StylistSelection = z.infer<typeof StylistOutputSchema>['selections'][number];

interface RunStylistAgentParams {
    occasion: ParsedOccasion;
    occasionText: string;
    catalog: Garment[];
    skinConcerns?: { type: string; ui_score: number }[];
}

/**
 * Picks up to 3 garments from the catalog for the given occasion, with a
 * short human-readable reason for each. This is the actual "stylist agent" —
 * no rule-based fallback, it's a real LLM call.
 */
export async function runStylistAgent({
    occasion,
    occasionText,
    catalog,
    skinConcerns = [],
}: RunStylistAgentParams): Promise<StylistSelection[]> {
    const catalogSummary = catalog
        .map(
            (g) =>
                `- id: ${g.id} | ${g.name} | category: ${g.category} | color: ${g.colorFamily ?? 'unspecified'} | tags: ${g.formalityTags.join(', ')}`,
        )
        .join('\n');

    const concernsSummary = skinConcerns.length
        ? skinConcerns.map((c) => `${c.type}: ${c.ui_score}/100`).join(', ')
        : 'not available';

    const result = await invokeStructured(
        [
            {
                role: 'system',
                content:
                    'You are a styling agent for Mirror, an app that matches outfits to occasions. ' +
                    'Pick up to 3 garments from the given catalog that best fit the occasion and formality. ' +
                    'Only use garment ids that appear in the catalog — never invent one. ' +
                    'Each reason should be one short, concrete sentence a real user would find useful, ' +
                    'not generic praise ("looks great!"). If skin concern scores are available and relevant ' +
                    '(e.g. redness), you may factor color choice into your reasoning, but do not fabricate ' +
                    'connections that are not there. ' +
                    'Respond with ONLY a JSON object matching ' +
                    '{"selections":[{"garmentId":"string","reason":"string"}]} — no markdown fences, no commentary.',
            },
            {
                role: 'user',
                content: `Occasion: "${occasionText}" (type: ${occasion.occasionType}, formality: ${occasion.formality})
Skin concerns: ${concernsSummary}

Catalog:
${catalogSummary}`,
            },
        ],
        StylistOutputSchema,
        0.3,
    );

    // Defensive filter: drop any hallucinated ids that don't match the catalog,
    // rather than trusting the model's output blindly.
    const validIds = new Set(catalog.map((g) => g.id));
    return result.selections.filter((s) => validIds.has(s.garmentId));
}