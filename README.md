# Mirror

Mirror is an occasion-aware self-presentation app. You tell it what you're dressing for ("job interview Friday", "wedding next Saturday"), upload a selfie and a full-body photo, and it returns:

- A **skin report** with per-concern scores and actionable tips
- **Before/after simulations** showing what your skin would look like with each concern reduced
- **Outfit try-ons** — both real catalog garments and AI-generated fabric styles rendered on your body
- A **styling narrative** tying the occasion, skin findings, and outfit together

Built on the YouCam (Perfect Corp) AI API for skin analysis, skin simulation, cloth VTO, and fabric VTO.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui |
| Database | PostgreSQL (Neon/Vercel Postgres) via Drizzle ORM |
| Auth | Clerk |
| File Storage | Vercel Blob (private) |
| AI Agents | LangChain / LangGraph + OpenAI |
| AI Vision | YouCam (Perfect Corp) API |
| Icons | Remix Icon |

---

## Project Structure

```
mirror/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx        # Main dashboard
│   │   └── looks/[lookId]/
│   │       ├── page.tsx              # Look detail (skin report + outfit summary)
│   │       ├── skin/page.tsx         # Full skin report
│   │       └── outfit/page.tsx       # Outfit carousel (catalog / fabric)
│   ├── api/
│   │   ├── looks/
│   │   │   ├── route.ts              # Create / list looks
│   │   │   └── [lookId]/
│   │   │       ├── route.ts           # Look detail, narrative, select outfit
│   │   │       ├── skin/route.ts      # Skin scan results
│   │   │       ├── outfit/route.ts    # Catalog outfit renders
│   │   │       └── fabric/route.ts    # Fabric VTO renders
│   │   ├── skin-analysis/
│   │   │   ├── route.ts              # Start skin analysis
│   │   │   └── [taskId]/route.ts     # Poll skin analysis
│   │   ├── cloth-vto/
│   │   │   ├── route.ts              # Start catalog VTO
│   │   │   └── [taskId]/route.ts     # Poll cloth VTO
│   │   ├── fabric-vto/
│   │   │   ├── route.ts              # Start fabric VTO
│   │   │   └── [taskId]/route.ts     # Poll fabric VTO
│   │   └── skin-simulation/
│   │       ├── route.ts              # Start skin simulation
│   │       └── [taskId]/route.ts     # Poll skin simulation
│   └── layout.tsx
├── components/
│   ├── skin-report-card.tsx          # Skin report with per-concern scores
│   ├── before-after-toggle.tsx       # Before/after simulation toggle
│   ├── outfit-carousel.tsx           # Horizontal scrollable outfit cards
│   ├── agent-status.tsx             # "Agents working" progress UI
│   └── ui/                          # shadcn/ui primitives
├── lib/
│   ├── youcam/
│   │   ├── client.ts                # YouCam fetch wrapper + error types
│   │   ├── upload.ts                # Two-step file upload
│   │   ├── poll.ts                  # Polling helper
│   │   ├── skin-analysis.ts         # Skin analysis task API
│   │   ├── cloth-vto.ts             # Cloth VTO task API
│   │   ├── fabric-vto.ts            # Fabric VTO task API + template listing
│   │   └── skin-simulation.ts       # Skin simulation task API
│   ├── agents/
│   │   ├── planner.ts               # Occasion parsing agent
│   │   ├── stylist-agent.ts         # Garment/template selection agent
│   │   ├── skin-agent.ts            # (placeholder)
│   │   ├── synthesis-agent.ts       # Narrative generation agent
│   │   ├── graph.ts                 # LangGraph orchestration
│   │   └── model.ts                 # LLM invocation helper
│   └── storage.ts                   # Vercel Blob persistence + signed URLs
├── db/
│   ├── schema.ts                    # Drizzle schema (all tables)
│   ├── seed.ts                      # Seed garments catalog
│   └── seed-fabric-templates.ts     # Seed fabric templates from YouCam
├── types/
│   └── index.ts                     # Shared TypeScript types
└── docs/
    └── plan.md                      # Implementation plan
```

---

## Architecture

### Look Flow

```mermaid
flowchart TD
    A[User enters occasion text] --> B[POST /api/looks]
    B --> C[Planner Agent parses occasion]
    C --> D{Occasion type, formality, timeframe}
    D --> E[Skin Analysis]
    D --> F[Outfit Try-On]

    E --> E1[Upload selfie to YouCam]
    E1 --> E2[Create skin-analysis task]
    E2 --> E3[Poll until complete]
    E3 --> E4[Persist mask URLs to Blob]
    E4 --> E5[Insert skinScans row]

    F --> F1[Stylist Agent picks garments/templates]
    F1 --> F2[Upload body photo to YouCam]
    F2 --> F3[Create cloth-v4 / fabric tasks]
    F3 --> F4[Poll each task]
    F4 --> F5[Persist renders to Blob]
    F5 --> F6[Insert outfitRenders rows]

    E5 --> G[Synthesis Agent]
    F6 --> G
    G --> H[Generate narrative]
    H --> I[Look complete]

    style A fill:#f9f,stroke:#333
    style I fill:#9f9,stroke:#333
```

```
User input (occasion text)
    │
    ▼
POST /api/looks ──► Planner agent parses occasion
    │                  (occasionType, formality, timeframeDays)
    │
    ▼
Skin Analysis ──► Upload selfie → YouCam skin-analysis task
    │               Poll → persist mask URLs → insert skinScans row
    │
    ▼
Outfit Try-On ──► Stylist agent picks garments/templates
    │               Upload body photo → YouCam cloth-v4 / fabric tasks
    │               Poll each → persist renders → insert outfitRenders rows
    │
    ▼
Synthesis ──► Generate narrative tying occasion + skin + outfit
```

### Data Model

```mermaid
erDiagram
    looks ||--o{ tasks : "has"
    looks ||--o{ skinScans : "has"
    looks ||--o{ outfitRenders : "has"
    looks }o--|| outfitRenders : "selectedOutfitRenderId"
    tasks ||--o| skinScans : "taskId"
    tasks ||--o| outfitRenders : "taskId"
    tasks ||--o| skinSimulations : "taskId"
    outfitRenders }o--|| garments : "garmentId"
    outfitRenders }o--|| fabricTemplates : "fabricTemplateId"
    looks ||--o{ skinSimulations : "has"

    looks {
        uuid id PK
        text userId
        text occasionText
        text occasionType
        text formality
        int timeframeDays
        uuid selectedOutfitRenderId FK
        text narrative
        text bodyFileId
        text storedBodyUrl
        timestamp createdAt
    }

    tasks {
        uuid id PK
        text youcamTaskId
        text kind
        text status
        text errorCode
        uuid lookId FK
        timestamp createdAt
        timestamp completedAt
    }

    skinScans {
        uuid id PK
        uuid lookId FK
        uuid taskId FK
        text mode
        jsonb concerns
        jsonb storedMaskUrls
        text srcFileId
        text storedSelfieUrl
        timestamp createdAt
    }

    outfitRenders {
        uuid id PK
        uuid lookId FK
        uuid taskId FK
        uuid garmentId FK
        uuid fabricTemplateId FK
        text garmentCategory
        text refImageUrl
        text storedRenderUrl
        text reason
        timestamp createdAt
    }

    garments {
        uuid id PK
        text name
        text category
        text imageUrl
        text[] formalityTags
        text colorFamily
        timestamp createdAt
    }

    fabricTemplates {
        uuid id PK
        text youcamTemplateId
        text name
        text thumbnailUrl
        text category
        timestamp cachedAt
    }

    skinSimulations {
        uuid id PK
        uuid lookId FK
        uuid taskId FK
        text concernType
        text storedSimUrl
        timestamp createdAt
    }
```

- **`looks`** — one per occasion session (anchor for everything)
- **`tasks`** — tracks every async YouCam job (`skin_analysis`, `cloth_vto`, `fabric_vto`, `skin_simulation`)
- **`skinScans`** — skin analysis results (concerns, mask URLs, selfie URL, src file ID)
- **`outfitRenders`** — VTO render images (catalog garments + fabric templates)
- **`garments`** — static seed catalog of real garment photos
- **`fabricTemplates`** — cached YouCam fabric templates (seeded via script)
- **`skinSimulations`** — per-concern before/after simulation results

### Agent Pipeline

```mermaid
flowchart LR
    subgraph Input
        O[Occasion text]
        S[Skin concerns]
        C[Catalog / Templates]
    end

    subgraph Planner
        P[Parse occasion]
    end

    subgraph Stylist
        ST[Select garments/templates]
    end

    subgraph Synthesis
        SY[Generate narrative]
    end

    O --> P
    P --> ST
    S --> ST
    C --> ST
    ST --> SY
    S --> SY
    O --> SY

    style P fill:#bbf,stroke:#333
    style ST fill:#fbf,stroke:#333
    style SY fill:#bfb,stroke:#333
```

The stylist agent (`lib/agents/stylist-agent.ts`) is an LLM call that receives:
- The parsed occasion (type, formality, timeframe)
- A catalog (garments or fabric templates with id/name/category/color)
- Skin concern scores (optional, for color reasoning)

It returns up to 3 selections with garment IDs and human-readable reasons. Hallucinated IDs are filtered out.

The synthesis agent (`lib/agents/synthesis-agent.ts`) writes a 2-3 sentence narrative combining the occasion, skin findings, and chosen outfit.

---

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon, Vercel Postgres, or local)
- Clerk account (for auth)
- YouCam API key (Perfect Corp)
- Vercel Blob store (for image persistence)
- OpenAI API key (for LLM agents)

### Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/mirror

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# YouCam API
YOUCAM_API_KEY=your_youcam_api_key

# Vercel Blob
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# OpenAI (for agents)
OPENAI_API_KEY=sk-...

# Next.js Image Optimization
IMAGE_HOSTNAME=your-blob-store.public.blob.vercel-storage.com
```

### Installation

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Seed garment catalog
npm run db:seed

# Seed fabric templates from YouCam
npm run db:seed-fabric
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production

```bash
npm run build
npm run start
```

---

## API Routes

### Looks

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/looks` | Create a new look from occasion text |
| `GET` | `/api/looks` | List recent looks for the user |
| `GET` | `/api/looks/[lookId]` | Get look detail (skin, outfit, narrative) |
| `POST` | `/api/looks/[lookId]` | Generate styling narrative |
| `PATCH` | `/api/looks/[lookId]` | Set selected outfit render |

### Skin Analysis

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/skin-analysis` | Start skin analysis (multipart: lookId + face file) |
| `GET` | `/api/skin-analysis/[taskId]` | Poll skin analysis task |

### Outfit (Catalog)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/cloth-vto` | Start catalog VTO (multipart: lookId + body file) |
| `GET` | `/api/cloth-vto/[taskId]` | Poll cloth VTO task |
| `GET` | `/api/looks/[lookId]/outfit` | List catalog outfit renders |
| `PATCH` | `/api/looks/[lookId]/outfit` | Set selected outfit |

### Fabric VTO

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/fabric-vto` | Start fabric VTO (JSON: lookId) |
| `GET` | `/api/fabric-vto/[taskId]` | Poll fabric VTO task |
| `GET` | `/api/looks/[lookId]/fabric` | List fabric outfit renders |

### Skin Simulation

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/skin-simulation` | Start simulation (JSON: lookId + concernType) |
| `GET` | `/api/skin-simulation/[taskId]` | Poll simulation task |

---

## Database

### Schema

The database uses Drizzle ORM with PostgreSQL. Key tables:

- **`looks`** — occasion sessions
- **`tasks`** — async YouCam job tracking
- **`skinScans`** — skin analysis results
- **`outfitRenders`** — VTO render images
- **`garments`** — seed catalog
- **`fabricTemplates`** — cached YouCam templates
- **`skinSimulations`** — before/after simulation results

### Commands

```bash
npm run db:push         # Push schema changes to database
npm run db:generate     # Generate migration files
npm run db:migrate      # Run migrations
npm run db:studio       # Open Drizzle Studio (database browser)
npm run db:check        # Check for schema drift
npm run db:seed         # Seed garment catalog
npm run db:seed-fabric  # Seed fabric templates from YouCam API
```

---

## Features

### Skin Analysis

Upload a selfie → YouCam analyzes 6 skin concerns (redness, acne, texture, oiliness, dark circles, hydration) and returns scores + mask overlays. Each concern gets a progress bar and actionable tip.

### Before/After Simulation

Each concern row has a "See the difference" toggle that triggers a YouCam skin-simulation task, rendering the selfie with that concern reduced to maximum intensity. The original and simulated images are shown side-by-side.

### Catalog Outfit Try-On

The stylist agent picks up to 3 garments from the seed catalog based on the occasion and skin concerns. Each garment is rendered on the user's body via YouCam cloth-v4 VTO.

### Fabric Outfit Try-On

An alternative to catalog outfits — the stylist agent picks fabric templates from YouCam's predefined library (~30-60 styles). Each is rendered on the user's body via YouCam fabric VTO. Auto-generates when the user switches to the "Fabric" tab.

### Styling Narrative

After outfits are ready, the user can generate a 2-3 sentence narrative that ties the occasion, skin findings, and outfit choices together.

---

## Development Notes

### YouCam API Integration

```mermaid
sequenceDiagram
    participant App as Mirror App
    participant YouCam as YouCam API
    participant Blob as Vercel Blob

    App->>YouCam: POST /s2s/v2.0/file (register file)
    YouCam-->>App: file_id + presigned URL
    App->>YouCam: PUT presigned URL (upload bytes)
    App->>YouCam: POST /s2s/v2.0/task/{kind} (create task)
    YouCam-->>App: task_id

    loop Poll every 2.5s
        App->>YouCam: GET /s2s/v2.0/task/{kind}/{task_id}
        YouCam-->>App: task_status (running/success/error)
    end

    YouCam-->>App: results.url (2h expiry)
    App->>Blob: Download + persist result
    Blob-->>App: stored URL
    App->>App: Update DB row with stored URL
```

All YouCam calls go through `lib/youcam/client.ts` (`youcamFetch`), which:
- Adds the Bearer token from `YOUCAM_API_KEY`
- Throws `YouCamApiError` on non-2xx responses
- Returns parsed JSON

File uploads use a two-step process: register the file (get `file_id` + presigned URL), then PUT bytes to the presigned URL.

Task results expire after 2 hours on YouCam's servers, so all results are persisted to Vercel Blob immediately upon task completion.

### Polling Pattern

Long-running YouCam tasks are polled via dedicated API routes (`/api/{kind}/{taskId}`). The client polls every 2.5s until the task resolves. The route handles persisting results to blob and updating the database.

### Agent Pattern

Agents use `invokeStructured` from `lib/agents/model.ts` which wraps an LLM call with Zod schema validation. The stylist agent uses a StateGraph (LangGraph) with a single node for now, designed to be extended with additional nodes.

### Error Handling

YouCam errors are parsed into user-friendly messages in the skin-analysis poll route. Common errors include:
- `error_lighting_dark` — photo too dark
- `error_src_face_too_small` — face too small in frame
- `error_below_min_image_size` — resolution too low

---

## License

This project is open-source and available under the [MIT License](https://github.com/Talha-Tahir2001/mirror/blob/main/LICENSE).

All rights reserved.
