import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { z } from 'zod';
import { invokeStructured } from './model';

/**
 * Synthesis agent — the final node of the mirror pipeline. It takes the
 * occasion, the (finished) skin report, and the chosen outfit (with the
 * stylist's reasons) and writes one short, warm, second-person narrative that
 * ties them together. This is what the user actually reads on the look page.
 */

interface SynthesisInput {
    occasionText: string;
    occasionType: string;
    formality: string;
    skinConcerns: { type: string; ui_score: number }[];
    garments: { name: string; reason: string }[];
}

const NarrativeSchema = z.object({
    narrative: z
        .string()
        .describe(
            'A 2-3 sentence, warm, second-person styling narrative that ties the occasion, the skin findings, and the chosen outfit together. Concrete, specific, never generic.',
        ),
});

const SynthesisState = Annotation.Root({
    input: Annotation<SynthesisInput>,
    narrative: Annotation<string>,
});

const synthesisGraph = new StateGraph(SynthesisState)
    .addNode('synthesize', async (state) => {
        const { input } = state;

        const concerns = input.skinConcerns.length
            ? input.skinConcerns.map((c) => `${c.type}: ${c.ui_score}/100`).join(', ')
            : 'not available';
        const garments = input.garments
            .map((g) => `- ${g.name} — ${g.reason}`)
            .join('\n');

        const result = await invokeStructured(
            [
                {
                    role: 'system',
                    content:
                        'You are the styling narrator for Mirror, an occasion-aware self-presentation app. ' +
                        'You receive the occasion, the user\'s skin analysis, and their chosen outfit. ' +
                        'Write a 2-3 sentence narrative in second person ("you") that tells the user how the outfit ' +
                        'pairs with their skin and suits the occasion. Be concrete — reference specific concerns ' +
                        '(e.g. calm the redness, balance oiliness) and specific garment choices with their reasoning. ' +
                        'Do not invent facts. Keep it to a warm, confident paragraph. ' +
                        'Respond with ONLY a JSON object matching {"narrative":"string"} — no markdown fences, no commentary.',
                },
                {
                    role: 'user',
                    content: `Occasion: "${input.occasionText}" (type: ${input.occasionType}, formality: ${input.formality})
Skin concerns: ${concerns}

Chosen outfit:
${garments}`,
                },
            ],
            NarrativeSchema,
            0.5,
        );

        return { narrative: result.narrative };
    })
    .addEdge(START, 'synthesize')
    .addEdge('synthesize', END);

export const mirrorSynthesisGraph = synthesisGraph.compile();

export async function generateNarrative(input: SynthesisInput): Promise<string> {
    const result = await mirrorSynthesisGraph.invoke({ input });
    return result.narrative;
}
