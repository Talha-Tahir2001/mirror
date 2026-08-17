import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { runStylistAgent, type StylistSelection } from './stylist-agent';
import type { ParsedOccasion } from './planner';
import type { garments } from '@/db/schema';

type Garment = typeof garments.$inferSelect;

const MirrorState = Annotation.Root({
    occasionText: Annotation<string>,
    occasion: Annotation<ParsedOccasion>,
    catalog: Annotation<Garment[]>,
    skinConcerns: Annotation<{ type: string; ui_score: number }[]>,
    stylistSelections: Annotation<StylistSelection[]>,
});

// Single-node graph for now — this is intentionally the seam where
// planner/skin-agent/synthesis-agent nodes get added once skin-tone
// analysis and the rest of the pipeline exist. Using StateGraph even for
// one node keeps the shape consistent with where this is headed.
const graph = new StateGraph(MirrorState)
    .addNode('stylist', async (state) => {
        const stylistSelections = await runStylistAgent({
            occasion: state.occasion,
            occasionText: state.occasionText,
            catalog: state.catalog,
            skinConcerns: state.skinConcerns,
        });
        return { stylistSelections };
    })
    .addEdge(START, 'stylist')
    .addEdge('stylist', END);

export const mirrorGraph = graph.compile();

interface RunMirrorGraphParams {
    occasionText: string;
    occasion: ParsedOccasion;
    catalog: Garment[];
    skinConcerns?: { type: string; ui_score: number }[];
}

export async function runMirrorGraph({
    occasionText,
    occasion,
    catalog,
    skinConcerns = [],
}: RunMirrorGraphParams): Promise<StylistSelection[]> {
    const result = await mirrorGraph.invoke({
        occasionText,
        occasion,
        catalog,
        skinConcerns,
    });
    return result.stylistSelections;
}