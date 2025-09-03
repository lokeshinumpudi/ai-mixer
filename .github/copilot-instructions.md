# AI Comparo - Copilot Instructions

## Repository Overview

AI Comparo is a Next.js 15 AI chatbot platform with multi-provider AI integration, real-time streaming, artifacts generation, and subscription billing. Built with TypeScript, Drizzle ORM, Auth.js v5, and the AI SDK Gateway.

**Key Features:**

- Multi-provider AI chat (xAI, Google, OpenRouter)
- Artifacts system (code, documents, images, spreadsheets)
- Tiered pricing with Razorpay integration (Free: 20 msgs/day, Pro: 1000 msgs/month ₹249)
- Real-time usage tracking and billing enforcement
- Type-safe authentication with route protection

**Tech Stack:** Next.js 15, React Server Components, AI SDK v5, Drizzle ORM, PostgreSQL, Auth.js v5, shadcn/ui, Tailwind CSS

## Critical Development Rules (.cursor/rules/)

**ALWAYS follow these patterns - they are enforced by pre-commit hooks:**

### Database Operations

- **ALL database queries MUST be in `lib/db/queries.ts`** - Never write raw queries in routes
- Use naming: `get*`, `create*`, `update*`, `delete*`, `upsert*`
- Wrap in try/catch with `ChatSDKError` for consistent error handling

### Authentication Patterns

- Use auth decorators: `protectedRoute()`, `publicRoute()`, `authenticatedRoute()`
- Configure routes in `lib/route-config.ts` with glob patterns
- Session management via `SessionUtils` from `lib/auth/session-config.ts`

### Development Workflow

- **PREFER `pnpm lint` over `pnpm build`** for routine changes
- **NEVER start `pnpm dev` if already running** - check terminal first
- Use `read_lints [file-path]` for targeted validation

### Code Quality (ENFORCED)

- Pre-commit hooks run: type-check, lint, format (auto-fixes)
- TypeScript strict mode - zero tolerance for type errors
- Max 15 warnings allowed in CI

## Build & Development Commands

**Prerequisites:** Node.js 18+, pnpm, PostgreSQL database

### Essential Commands (VALIDATED)

```bash
# Setup (run once)
pnpm install
pnpm db:migrate

# Daily development (FAST - use these)
pnpm dev                    # Start dev server (check if running first!)
pnpm lint                   # Type check + ESLint (preferred)
pnpm format                 # Auto-format code

# Database operations
pnpm db:generate           # Generate migration
pnpm db:migrate           # Run migrations
pnpm db:studio            # Open Drizzle Studio

# Full validation (SLOW - only when needed)
pnpm build                # Full production build
pnpm test                 # Playwright e2e tests
pnpm pre-commit          # Full pre-commit validation
```

**CRITICAL:** Always run `pnpm db:migrate` after pulling schema changes. Always check if dev server is running before starting new one.

## Project Architecture & Layout

### Core Directory Structure

```
app/                    # Next.js App Router
├── (auth)/            # Authentication routes (/login)
│   ├── actions.ts     # Auth server actions
│   └── api/auth/      # NextAuth.js API routes
└── (chat)/            # Chat interface (/)
    ├── api/           # API routes (chat, billing, models, usage)
    ├── actions.ts     # Chat server actions
    └── page.tsx       # Main chat interface

components/            # UI components (shadcn/ui + custom)
├── ui/               # shadcn/ui base components
├── chat.tsx          # Main chat component
├── model-picker.tsx  # AI model selection
└── artifact*.tsx     # Artifact system components

lib/                  # Core application logic
├── ai/               # AI SDK integration
│   ├── models.ts     # Model configuration
│   ├── providers.ts  # AI provider setup
│   └── tools/        # AI tools (weather, documents)
├── db/               # Database layer
│   ├── schema.ts     # Drizzle schema definitions
│   ├── queries.ts    # ALL database operations (CRITICAL)
│   └── migrations/   # Database migrations
├── auth/             # Authentication configuration
│   └── session-config.ts # Session management
├── constants.ts      # Model config, pricing, entitlements
├── route-config.ts   # API route access control
└── auth-decorators.ts # Route protection decorators

artifacts/            # Artifact implementations
├── code/             # Code generation
├── text/             # Document creation
├── image/            # Image generation
└── sheet/            # Spreadsheet tools

hooks/                # Custom React hooks
├── use-usage.ts      # Real-time usage tracking
└── use-models.ts     # Model management
```

### Key Configuration Files

- `package.json` - Scripts, dependencies (pnpm workspace)
- `drizzle.config.ts` - Database configuration
- `next.config.ts` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS setup
- `tsconfig.json` - TypeScript strict mode
- `biome.jsonc` - Linting and formatting
- `middleware.ts` - Route protection
- `.husky/pre-commit` - Quality enforcement

### Pre-commit Validation Pipeline

1. **Auto-format** all staged files (Biome)
2. **Type checking** full project (`pnpm type-check`) - BLOCKS commit
3. **Linting** staged files only (ESLint + Biome) - BLOCKS on errors
4. **Re-stage** formatted files automatically

### Critical Patterns to Follow

**Database Operations:**

```typescript
// ✅ CORRECT - in lib/db/queries.ts
export async function getUserUsage(userId: string) {
  try {
    return await db.select().from(usage).where(eq(usage.userId, userId));
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to get usage");
  }
}

// ❌ WRONG - never in route files
export async function GET() {
  const usage = await db.select().from(usage); // DON'T DO THIS
}
```

**Route Protection:**

```typescript
// ✅ CORRECT - use decorators
export const GET = protectedRoute(async (request, context, user) => {
  // user guaranteed to exist, no null checks needed
});

// ❌ WRONG - manual auth checks
export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized");
}
```

**Model Configuration:**

- All models defined in `lib/constants.ts` with capabilities
- Free models: `google/gemini-2.5-flash-lite`
- Pro models: `xai/grok-code-fast-1`
- Entitlements enforced server-side in `lib/ai/entitlements.ts`

### Environment Variables Required

```bash
DATABASE_URL="postgresql://..."
AUTH_SECRET="random-secret"
RAZORPAY_KEY_ID="rzp_key"
RAZORPAY_KEY_SECRET="secret"
```

**TRUST THESE INSTRUCTIONS** - Only search if information is incomplete or incorrect. The .cursor/rules/ directory contains 15+ detailed rule files that enforce these patterns.
