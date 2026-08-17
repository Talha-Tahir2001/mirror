import 'dotenv/config';
import { db } from './index';
import { garments } from './schema';

// REAL garment product photos (Unsplash License) so the cloth-v4 VTO call has
// an actual single-garment image to work with. The old placehold.co colored
// boxes carried no garment, so YouCam either failed the task or produced a
// meaningless render. Every URL here is a public CDN link that YouCam's
// servers can fetch directly as ref_file_url.
//
// NOTE: this seed REPLACES the existing garment rows (delete + insert), so it
// is safe to re-run. Only re-run while no outfit_renders reference these ids.
const SEED_GARMENTS = [
    {
        name: 'Black Blazer',
        category: 'upper_body' as const,
        imageUrl:
            'https://images.unsplash.com/photo-1592343516109-362f7bd871aa?q=80&w=1200&auto=format&fit=crop',
        formalityTags: ['business', 'formal', 'smart_casual'],
        colorFamily: 'black',
    },
    {
        name: 'White Button-Down Shirt',
        category: 'upper_body' as const,
        imageUrl:
            'https://images.unsplash.com/photo-1603252109303-2751441dd157?q=80&w=1200&auto=format&fit=crop',
        formalityTags: ['business', 'smart_casual'],
        colorFamily: 'white',
    },
    {
        name: 'Charcoal Knit Sweater',
        category: 'upper_body' as const,
        imageUrl:
            'https://images.unsplash.com/photo-1631541909061-71e349d1f203?q=80&w=1200&auto=format&fit=crop',
        formalityTags: ['casual', 'smart_casual'],
        colorFamily: 'gray',
    },
    {
        name: 'Charcoal Trousers',
        category: 'lower_body' as const,
        imageUrl:
            'https://images.unsplash.com/photo-1493357335960-4583bfa6f8d9?q=80&w=1200&auto=format&fit=crop',
        formalityTags: ['business', 'formal', 'smart_casual'],
        colorFamily: 'gray',
    },
    {
        name: 'Black Trousers',
        category: 'lower_body' as const,
        imageUrl:
            'https://images.unsplash.com/photo-1611858447026-b16c9351c9df?q=80&w=1200&auto=format&fit=crop',
        formalityTags: ['business', 'formal', 'smart_casual'],
        colorFamily: 'black',
    },
    {
        name: 'Dark Wash Jeans',
        category: 'lower_body' as const,
        imageUrl:
            'https://images.unsplash.com/photo-1602293589930-45aad59ba3ab?q=80&w=1200&auto=format&fit=crop',
        formalityTags: ['casual', 'smart_casual'],
        colorFamily: 'blue',
    },
];

async function seed() {
    console.log(`Replacing existing garments with ${SEED_GARMENTS.length} real-product images...`);
    await db.delete(garments);
    await db.insert(garments).values(SEED_GARMENTS);
    console.log('Done.');
    process.exit(0);
}

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
