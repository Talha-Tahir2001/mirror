export interface ParsedOccasion {
    occasionType: string;
    formality: 'casual' | 'smart_casual' | 'business' | 'formal';
    timeframeDays: number;
}

// TODO: replace with an actual LLM call (this is the real "planner agent").
// Keeping this as a plain heuristic for now so the rest of the pipeline
// (task creation, DB writes, UI) can be built and tested without needing
// the agent graph wired up yet.
const FORMALITY_KEYWORDS: Record<string, ParsedOccasion['formality']> = {
    interview: 'business',
    wedding: 'formal',
    gala: 'formal',
    date: 'smart_casual',
    party: 'smart_casual',
    everyday: 'casual',
    weekend: 'casual',
};

export function parseOccasion(occasionText: string): ParsedOccasion {
    const lower = occasionText.toLowerCase();

    const matchedKeyword = Object.keys(FORMALITY_KEYWORDS).find((kw) =>
        lower.includes(kw),
    );
    const occasionType = matchedKeyword ?? 'general';
    const formality = matchedKeyword
        ? FORMALITY_KEYWORDS[matchedKeyword]
        : 'smart_casual';

    // Very rough day-of-week distance guess; good enough as a placeholder.
    const dayNames = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
    ];
    const mentionedDay = dayNames.find((d) => lower.includes(d));
    let timeframeDays = 3; // default assumption if no day is mentioned

    if (mentionedDay) {
        const today = new Date().getDay();
        const target = dayNames.indexOf(mentionedDay);
        timeframeDays = (target - today + 7) % 7 || 7;
    }

    return { occasionType, formality, timeframeDays };
}