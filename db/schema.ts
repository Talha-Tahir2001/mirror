import { pgTable, uuid, text, integer, timestamp, jsonb, AnyPgColumn } from 'drizzle-orm/pg-core';

// One "look" = one occasion-driven session (e.g. "Job interview Friday").
// This is the anchor everything else hangs off.
export const looks = pgTable('looks', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(), // Clerk user id
    occasionText: text('occasion_text').notNull(), // raw input, e.g. "Job interview Friday"
    occasionType: text('occasion_type'), // parsed by planner agent, e.g. "interview"
    formality: text('formality'), // "casual" | "smart_casual" | "business" | "formal"
    timeframeDays: integer('timeframe_days'), // days until the occasion, drives skin plan aggressiveness
    selectedOutfitRenderId: uuid('selected_outfit_render_id').references(
        (): AnyPgColumn => outfitRenders.id,
    ),
    narrative: text('narrative'), // styling agent's final synthesis (skin + outfit)
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Tracks every async YouCam job. This is the audit trail for the job lifecycle
// (upload -> create task -> poll -> success/error) and drives the "agents working" UI.
export const tasks = pgTable('tasks', {
    id: uuid('id').primaryKey().defaultRandom(),
    youcamTaskId: text('youcam_task_id').notNull(),
    kind: text('kind').$type<'skin_analysis' | 'cloth_vto'>().notNull(),
    status: text('status').$type<'running' | 'success' | 'error'>().notNull().default('running'),
    errorCode: text('error_code'), // e.g. error_no_face, error_lighting_dark, InvalidParameters
    lookId: uuid('look_id')
        .references(() => looks.id)
        .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
});

// One row per skin-analysis result. `concerns` stores the raw output[] array from
// YouCam (type/region/raw_score/ui_score/mask_urls) so we don't lose anything the
// skin agent might want later.
export const skinScans = pgTable('skin_scans', {
    id: uuid('id').primaryKey().defaultRandom(),
    lookId: uuid('look_id')
        .references(() => looks.id)
        .notNull(),
    taskId: uuid('task_id')
        .references(() => tasks.id)
        .notNull(),
    mode: text('mode').$type<'sd' | 'hd'>().notNull().default('sd'),
    concerns: jsonb('concerns').notNull(), // raw YouCam output[] array
    storedMaskUrls: jsonb('stored_mask_urls'), // our own blob URLs, fetched before the 2h link expires
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// One row per VTO render. A single "look" can have several of these (user swaps outfits).
export const outfitRenders = pgTable('outfit_renders', {
    id: uuid('id').primaryKey().defaultRandom(),
    lookId: uuid('look_id')
        .references(() => looks.id)
        .notNull(),
    taskId: uuid('task_id')
        .references(() => tasks.id)
        .notNull(),
    garmentId: uuid('garment_id').references(() => garments.id), // nullable: may be a one-off ref image, not catalog
    garmentCategory: text('garment_category').$type<
        'full_body' | 'lower_body' | 'upper_body' | 'shoes' | 'outer' | 'auto'
    >().notNull(),
    refImageUrl: text('ref_image_url').notNull(), // the garment reference image sent to YouCam
    storedRenderUrl: text('stored_render_url'), // our own blob URL, fetched before the 2h link expires
    reason: text('reason'), // stylist agent's rationale for picking this garment
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Static seed catalog for the demo — not user-uploaded.
export const garments = pgTable('garments', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    category: text('category').$type<
        'full_body' | 'lower_body' | 'upper_body' | 'shoes' | 'outer'
    >().notNull(),
    imageUrl: text('image_url').notNull(),
    formalityTags: text('formality_tags').array().notNull().default([]),
    colorFamily: text('color_family'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});