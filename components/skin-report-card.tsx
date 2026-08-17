import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { SkinAnalysisOutputItem } from '@/types';

export const CONCERN_META: Record<string, { label: string; tip: string }> = {
    redness: {
        label: 'Redness',
        tip: 'A calming, fragrance-free mask the night before can bring this down fast.',
    },
    acne: {
        label: 'Acne',
        tip: 'Avoid trying new products this week — stick to what your skin already tolerates.',
    },
    texture: {
        label: 'Texture',
        tip: 'A gentle exfoliant 48 hours out, not the night before, evens this out without irritation.',
    },
    oiliness: {
        label: 'Oiliness',
        tip: 'Blotting papers and a lightweight moisturizer keep shine down through the day.',
    },
    dark_circle_v2: {
        label: 'Dark circles',
        tip: 'A cold compress and an extra hour of sleep the night before makes a visible difference.',
    },
    moisture: {
        label: 'Hydration',
        tip: 'A hydrating serum for the next few nights will show up in how your skin catches light.',
    },
};

function scoreColor(score: number) {
    if (score >= 75) return 'bg-accent';
    if (score >= 50) return 'bg-chart-5';
    return 'bg-destructive';
}

interface SkinReportCardProps {
    concerns: SkinAnalysisOutputItem[];
}

export function SkinReportCard({ concerns }: SkinReportCardProps) {
    // YouCam sometimes returns aggregate/technical rows (all, skin_age,
    // resize_image) that aren't real concerns — drop anything we don't have a
    // label for.
    const visible = concerns.filter((c) => CONCERN_META[c.type]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-serif text-xl">Your skin, right now</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                {visible.map((concern) => {
                    const meta = CONCERN_META[concern.type] ?? {
                        label: concern.type,
                        tip: '',
                    };
                    return (
                        <div key={concern.type} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{meta.label}</span>
                                <Badge variant="secondary">{concern.ui_score}/100</Badge>
                            </div>
                            <Progress
                                value={concern.ui_score}
                                className="h-2"
                                indicatorClassName={scoreColor(concern.ui_score)}
                            />
                            {meta.tip && (
                                <p className="text-xs text-muted-foreground">{meta.tip}</p>
                            )}
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}