# TeacherDash — CTO Code Review
## February 27, 2026

**Reviewer:** Incoming CTO
**Codebase:** teacher-dashboard-v2 (Next.js 16 / Supabase / Gemini+Anthropic)
**Commit reviewed:** `afeecdf` (master HEAD)
**Spec documents reviewed:** v1 Project Spec, v2 Complete Spec
**Note:** The v3 Platform Spec referenced in the brief does not yet exist in the project tree.

---

## Executive Summary

This is a remarkably functional single-developer product built in roughly 10 commits. It already delivers real daily value to a real teacher — bellringer generation, TV display, lesson planning, materials generation, standards tracking, substitute dashboards, calendar management, task management, and a principal portal. The AI integration is genuinely sophisticated, with dual-provider support (Gemini/Anthropic), contextual prompt engineering, and a knowledge base that improves over time.

**However, this is a prototype that works for one trusted user on a trusted network.** Scaling it to a multi-tenant SaaS product requires fundamental changes to authentication, authorization, data isolation, and infrastructure. The good news: the core product logic is solid and the architecture is sound enough that these changes are additive, not a rewrite.

**Bottom line:** Ship nothing new until auth and security are hardened. Then this becomes a very compelling product.

---

## 1. Architecture

### What's Good

- **Next.js App Router** is the right choice. Server-side API routes keep AI keys off the client. The `(dashboard)` and `(fullscreen)` route groups cleanly separate authenticated and public layouts.
- **Supabase** as the database layer is excellent for this stage — managed Postgres, real-time capability, storage, auth (unused), and a generous free tier.
- **Dual AI provider support** (Gemini + Anthropic) with a clean abstraction layer (`ai-service.ts`) is surprisingly mature. The retry logic, rate-limit detection, and 6-strategy JSON parser are production-quality.
- **File organization** is logical: `lib/` for business logic, `components/` for UI, `app/api/` for routes, `data/` for seed content. Easy to onboard new developers.
- **The "context engine" pattern** — assembling teaching context for every AI call — is the product's secret weapon and a genuine competitive moat.

### What Must Change to Scale

| Issue | Current State | Required for 1K+ Users |
|-------|--------------|----------------------|
| **Authentication** | Zero. No login, no sessions, no user identity. | Must add Supabase Auth or NextAuth. Every route needs middleware. |
| **Multi-tenancy** | All data is global. One teacher's bellringers are everyone's bellringers. | Add `user_id` / `tenant_id` to every table. RLS policies must filter by authenticated user. |
| **Row-Level Security** | RLS is "enabled" but every policy is `USING (true)` — effectively disabled. | Write real policies: `USING (auth.uid() = user_id)`. |
| **API route protection** | 51 API routes, 0 auth checks. | Middleware or per-route guards on every non-public endpoint. |
| **Environment config** | AI keys can be stored in DB settings table (queryable via anon key). | Keys must be server-only env vars or encrypted at rest. Never in a client-accessible table. |
| **Rate limiting** | None. Rely entirely on AI provider rate limits. | Add per-user rate limiting, especially on AI generation endpoints. |

### Architecture Recommendation

```
Phase 1 (Now):     Add Supabase Auth + RLS. Add user_id columns. Middleware.
Phase 2 (Soon):    Move to organization/school-level tenancy (one school = one tenant).
Phase 3 (v3):      Multi-school with admin roles, teacher roles, principal roles.
```

The single-tenant architecture is fine for the current one-user reality. But every new table and every new feature should be built with `user_id` from day one.

---

## 2. Security

### CRITICAL — Fix Before Any Public Deployment

**S1. No Authentication Anywhere**
- 51 API routes, 0 auth checks
- Anyone who knows the URL can read/write all data
- The Supabase anon key is in a `NEXT_PUBLIC_` env var (by Supabase design), meaning any browser can query the DB directly, bypassing API routes entirely
- Combined with `USING (true)` RLS policies, this means **the entire database is publicly readable and writable by anyone with the Supabase URL and anon key**
- **Risk:** Total data exposure if URL leaks. For a single user on localhost/private Vercel deploy this is acceptable. For a public product, this is a showstopper.
- **Fix:** Implement Supabase Auth. Write real RLS policies. Add auth middleware to all API routes.

**S2. API Keys Stored in Database Settings Table**
- `getAIConfig()` in `ai-service.ts` reads Gemini and Anthropic API keys from the `settings` table
- The `settings` table is accessible via the Supabase anon key (no RLS)
- Microsoft 365 OAuth client secret and access/refresh tokens are also stored in `settings`
- **Risk:** API key theft, email account compromise
- **Fix:** Move all secrets to server-only environment variables. Never store API keys in a database accessible by the client.

**S3. OAuth Implementation Missing CSRF Protection**
- `/api/email/callback` doesn't validate a `state` parameter
- No nonce or PKCE flow
- **Risk:** OAuth CSRF attacks, session fixation
- **Fix:** Implement standard OAuth state parameter validation. Consider PKCE.

**S4. File Uploads Have No Size Limits**
- Image uploads (`bellringers/upload-image`), PDF imports (`calendar/import-pdf`), DOCX imports (`lesson-plans/import`) accept arbitrarily large files
- Files are read entirely into memory (base64 for AI, Buffer for mammoth)
- **Risk:** Memory exhaustion DoS. A single 500MB upload crashes the server.
- **Fix:** Enforce file size limits (10MB for images, 50MB for documents). Validate MIME types server-side.

### HIGH — Fix Before Scaling

**S5. Published Lesson Plans Are Fully Public**
- `/plans/[token]` is by design public (no auth), but comments have no rate limiting and no spam protection
- Anyone who guesses/brute-forces a token can read lesson plan content
- **Fix:** Use longer tokens (UUID v4 is fine). Add rate limiting to comment endpoints. Consider optional PIN for principal access.

**S6. No Input Sanitization on User Content**
- Activity titles, task text, and comments are stored and rendered without sanitization
- While React's JSX escaping prevents most XSS, the HTML export (`export-service.ts`) manually builds HTML strings
- `escapeHtml()` is used in exports (good), but double-check all code paths
- **Fix:** Audit all HTML-building code paths. Consider a Content Security Policy header.

**S7. CSV Import Custom Parser**
- Hand-rolled CSV parser in `calendar/import-csv` instead of a battle-tested library
- **Fix:** Replace with `papaparse` or similar.

### What's Actually Fine

- `.env.local` is properly gitignored and was never committed to git history
- The Supabase anon key is a *publishable* key (not a service role key) — Supabase designed it to be public, with RLS as the security layer. The problem is RLS is disabled, not that the key is visible.
- AI prompt injection risk is low because the tool is teacher-facing (the user IS the prompt author)
- The `escapeHtml()` usage in export-service.ts is correctly implemented

---

## 3. Database Schema

### What's Good

- Clean relational design with proper foreign keys
- Good use of indexes on frequently-queried columns (date, class_id, bellringer_id)
- `bellringer_prompts` as a separate table for the 4-slot system is well-normalized
- `activity_standards` junction table with `UNIQUE(activity_id, standard_id)` prevents duplicates
- `JSONB` for `material_content` and `brainstorm_history` is the right call — flexible schema for AI-generated content
- `settings` as key-value store is appropriate for app configuration

### What Must Change for v3

| v3 Feature | Schema Gap | Required Change |
|------------|-----------|-----------------|
| **Multi-user/Multi-school** | No `user_id` on any table | Add `user_id UUID REFERENCES auth.users(id)` to every table. Massive migration. |
| **Curriculum Engine** | Standards are flat (code, description) | Add `curriculum_id`, `scope`, `sequence_order`, `prerequisite_ids`, `strand_hierarchy`. Need a `curricula` table for different frameworks. |
| **Slide Presentations** | No slide/presentation tables | Add `presentations` (metadata) and `presentation_slides` (content per slide) tables. Link to activities/bellringers. |
| **Live Game Hosting** | No real-time game state | Add `game_sessions`, `game_participants`, `game_responses` tables. Will need Supabase Realtime channels. |
| **Student Accounts** | No students table | Add `students`, `student_class_enrollment`, `student_responses`. Major privacy/FERPA implications. |
| **Principal/Parent Portals** | Principal view exists but no auth | Add `portal_users` with roles (principal, parent, admin). Link to `school_id`. |
| **School Organizations** | No school/org concept | Add `organizations` and `organization_members` tables. All data becomes org-scoped. |

### Schema Debt

- `date` columns are stored as `TEXT` instead of `DATE` type. Works fine but loses database-level date validation and comparison.
- No `updated_at` trigger — the column exists but is only set by application code (could drift).
- `classes` table seeds `English-1`, `English-2`, `French-1` — the hyphenated naming is inconsistent with the spec's `English 9`, `English 10`, `French 1`. Minor but confusing.
- No soft deletes — all deletes are hard deletes. Consider adding `deleted_at` for audit trail.

---

## 4. Code Quality

### Strengths

- **TypeScript is used properly.** Interfaces are well-defined in `types.ts`. Strict mode is enabled. Very few `any` casts.
- **Consistent patterns.** Every API route follows the same try/catch structure. Every page component follows the same state/effect/render pattern.
- **AI service abstraction is excellent.** `generateWithRetry()` and `chatWithAI()` provide a clean interface that hides provider complexity. The 6-strategy JSON parser is genuinely robust.
- **Context engine is sophisticated.** `buildFullContext()` assembles a rich context object from 9 parallel queries. This is the product's core intelligence.
- **Task helpers are delightful.** Natural language date parsing ("tomorrow", "next friday"), fuzzy class matching ("e1" matches "English-1") — these are the kind of touches that make a product feel magic.
- **HTML export is solid.** `escapeHtml()`, proper print styles, teacher/school branding.

### Weaknesses

- **No tests.** Zero test files. No unit tests, no integration tests, no E2E tests. This is the single biggest code quality risk. Every change is a potential regression.
- **No error boundary.** If a component throws, the entire app crashes. Need React error boundaries.
- **Hardcoded constants scattered everywhere.** "WRITE A PARAGRAPH IN YOUR JOURNAL!" appears 5+ times. Temperature values, model names, default subprompts — all inline.
- **AI prompts are embedded in route handlers.** System prompts should be externalized (prompt templates in a dedicated directory) for versioning, A/B testing, and non-developer editing.
- **N+1 query pattern in context-engine.** `buildFullContext()` runs 9 parallel queries, then loops through classes with individual queries, then loops through lesson plans with individual queries. For 3 classes and 2 plans this is fine. For 20 classes it's a problem.
- **No request validation library.** Input validation is ad-hoc (manual checks in each route). Should use `zod` for schema validation.
- **Components are large.** The dashboard `page.tsx` and lesson plans `page.tsx` are likely 500+ line monoliths. Should be decomposed into smaller components.

### Code Smells

- `@ts-expect-error` for Gemini's `thinkingConfig` — track the SDK issue and remove when fixed
- Proxy pattern in `db.ts` for lazy loading is clever but confusing to new developers
- Backwards-compatibility code copying first bellringer prompt to main row should be removed after migration
- The `import-lesson-plans.js` script has hardcoded Windows paths and Supabase credentials

---

## 5. Performance

### What Works Today

- **Parallel API queries** in context-engine and day-view aggregation are well-optimized
- **Supabase connection pooling** handles the current load fine
- **Static assets** are served by Next.js/Vercel CDN
- **AI response caching** — not implemented but not needed yet (each request should be unique)

### What Will Break Under Real Usage

| Issue | Impact | Scale Threshold |
|-------|--------|----------------|
| **N+1 queries in context-engine** | Slow AI generation (adds 100-500ms per class) | 10+ classes per teacher |
| **No pagination on list endpoints** | Slow page loads, memory bloat | 100+ lesson plans, 500+ activities |
| **Full context sent to every AI call** | Token waste, slower responses, higher cost | Ongoing (compounds over time as context grows) |
| **Image uploads held in memory** | Memory spikes, potential OOM | Multiple concurrent uploads |
| **No CDN caching headers** | Repeated full page downloads | 50+ concurrent users |
| **Client-side rendering for dashboard** | Slow initial paint, no SSR | Measurable with slow school networks |
| **Supabase free tier limits** | 500MB database, 1GB storage, 50K monthly active users | ~100 active teachers (depending on usage) |

### Quick Wins

1. **Add database indexes** for common query patterns (already partially done — good)
2. **Implement pagination** on activities, bellringers, and lesson plans list endpoints
3. **Cache standards data** — it rarely changes. Load once, cache for the session.
4. **Batch class activity queries** — fetch all activities for all classes in one query, group in code
5. **Add `loading.tsx` files** to Next.js route groups for streaming SSR

---

## 6. UX/UI

### For a Non-Technical Teacher: Assessment

The spec says the target user "self-describes as aloof and disorganized and dislikes computers." With that lens:

**What's Working Beautifully**

- **TV Display mode is the crown jewel.** Auto-fit text, clean 3-page flow (Journal → Question → Answer), keyboard navigation, beautiful dark theme. This is what the teacher shows students every single day. It looks professional. A+.
- **Dashboard home page is well-organized.** 5-day calendar strip, countdown timers (grading period, semester end, next day off), class activity cards with status indicators. A teacher can open this at 7am and know exactly what's ready and what's not.
- **Email task extraction is killer.** Scans Microsoft 365 inbox, pulls out actionable items, queues them for one-click approval. This alone is worth the product for a busy teacher.
- **Natural language task input.** Type "call parent friday" and it parses the date automatically. Type "e1" and it matches to English-1. Zero friction.
- **Materials page with filtering.** Find any quiz, worksheet, or game you've ever generated. Filter by type, class, or search. Export to Word in one click.
- **Bellringer batch generation.** Generate a full week's bellringers in one click. Life-changing for Sunday night planning.
- **One-click sub dashboard.** Teacher is sick → generate a complete substitute plan with schedule, bellringers, activities, seating chart, emergency contacts. Share via link.

**What Needs Improvement**

| Issue | Impact | Fix |
|-------|--------|-----|
| **No onboarding flow** | New user sees empty dashboard with no guidance. Teacher would close the tab. | Add a first-run wizard: set name → add classes → paste API key → import calendar → done. |
| **Settings page is too technical** | "AI Provider", "API Key", "Gemini Model" — a teacher doesn't know what these mean. | Hide behind "Advanced". Default to Gemini. Show "AI is set up" / "AI needs setup" status. |
| **Too many navigation items** | 9 sidebar links (Home, Calendar, Lesson Plans, Materials, Standards, Tasks, Bellringer Library, Sub Dashboard, Settings). A teacher who "hates computers" doesn't want 9 choices. | Group into 3-4 primary tabs (Today, Plan, Materials, Settings). Move Standards/Library/Sub into sub-pages. |
| **Mobile experience is weak** | 5-column calendar grid, wide task tables, dense bellringer editor — none collapse gracefully to phone width. | The spec says "works on phone — teacher should be able to check tomorrow's readiness from the couch." This needs significant responsive work. |
| **No loading states on initial page load** | Dashboard fires multiple parallel API calls. Teacher sees blank sections for 1-2 seconds. | Add skeleton loading states. Show shimmer placeholders. |
| **No confirmation on destructive actions** | Deleting activities, bellringers, lesson plans — no "are you sure?" | Add confirmation modals for deletes. |
| **Toast notifications are inconsistent** | Some actions show success toasts, others don't. Some errors silently fail. | Standardize: every user action gets feedback (success or error toast). |
| **Standards page is overwhelming** | Coverage percentages, drill-downs, upload parsing — useful for compliance but a teacher will never voluntarily visit this page. | Make it truly passive. Surface gaps as gentle nudges on the lesson plan page instead. |

### Visual Design Assessment

- **Dark theme is well-executed.** Consistent color palette (`#1a1a2e` base, `#4ECDC4` teal accent, `#FFFF00` yellow highlights). Custom CSS variables. Coherent scrollbar and animation styling.
- **Typography is good.** Geist font family, clear hierarchy, readable at all sizes.
- **Card-based layout works.** Clean borders, consistent spacing, good visual grouping.
- **Color coding is meaningful.** Teal for active, yellow for warnings, green for done, red for urgent. Teacher can scan at a glance.
- **But:** No brand identity. No logo. No distinctive visual personality. This looks like a well-made internal tool, not a consumer product. For v3, invest in visual design/brand.

---

## 7. Accessibility & Device Support

### Mobile Responsiveness: C+

The spec explicitly requires phone support ("teacher should be able to check tomorrow's readiness from the couch"). Current state:

- Navigation has a hamburger menu (good)
- But dashboard, bellringer editor, lesson plans, task table, and standards page do NOT gracefully collapse to mobile widths
- The 5-column calendar strip is unusable on phones
- Inline editing (tasks, materials) doesn't work well on touch
- **Priority fix:** Define a "phone view" that shows: today's readiness status, bellringer status, task list. That's all a teacher needs from the couch.

### TV Display: A

- Auto-fit text sizing works well
- Clean 16:9 layout
- Readable from 30 feet (back of classroom)
- Keyboard navigation (arrows, spacebar, F for fullscreen, Escape to exit)
- One concern: color-coded prompt types rely solely on color (accessibility issue for colorblind students). Add text labels.

### Slow Network Resilience: C

- No service worker, no offline capability
- No optimistic UI updates — every action waits for server response
- AI generation takes 3-10 seconds with no progress indicator (just a spinner)
- Large initial bundle (React 19, Next.js 16, Supabase SDK, Anthropic SDK, docx, mammoth, etc.)
- **Priority fix:** Add loading states everywhere. Consider a lighter initial bundle. Progressive enhancement for poor connectivity.

### Screen Reader / Keyboard Navigation: D

- Missing `aria-label` on icon buttons throughout
- Color-only indicators (activity status dots, prompt type colors) lack text alternatives
- No skip-to-content links
- Form labels exist but focus management on modal open/close is missing
- Not WCAG compliant — this matters for an education product (potential legal requirement)

---

## 8. What's Working Well — Do NOT Change

1. **The AI abstraction layer** (`ai-service.ts`). Dual-provider, retry logic, 6-strategy JSON parser. This is production-quality code.

2. **The context engine pattern** (`context-engine.ts`). Building rich context for every AI call is the product's competitive moat. The teacher doesn't configure anything — the system just gets smarter over time.

3. **The bellringer generation system**. System prompts, day-of-week skill rotation, repetition avoidance, approved-bellringer feedback loop. This is a mature feature.

4. **The TV display mode**. Auto-fit text, clean layout, keyboard nav. This is what students see every day. It's polished.

5. **The data model philosophy**: "Enter once, appears everywhere." Activities flow from lesson plan → day view → class tiles → principal view → sub dashboard. This is the right architecture.

6. **Task helpers** — natural language date parsing, fuzzy class matching. Delightful UX.

7. **The export pipeline** — HTML lesson plan export with proper escaping, DOCX material export with answer keys. Works reliably.

8. **The SubDash system** — one-click substitute teacher dashboards with shareable links. Unique and high-value feature.

---

## 9. Biggest Risk If Shipped Tomorrow

**Risk #1: Data Exposure.** The Supabase database is completely open. RLS policies are `USING (true)`. The anon key is public by design. Anyone who discovers the Supabase URL (easily findable in browser network tab) can read and write every table — including stored API keys, email tokens, and all teacher data. This is not a theoretical risk; it's a guaranteed exploit.

**Risk #2: No Authentication = No Multi-User.** There is literally no concept of "who is using this." Two teachers on the same deployment see the same data, overwrite each other's settings, and share the same API keys. The product cannot be sold or shared until auth exists.

**Risk #3: AI Cost Surprise.** Currently using free tiers (Gemini: 1,000 req/day, Anthropic: limited). One teacher uses ~10-20 AI calls/day. At 100 teachers, that's 1,000-2,000 calls/day. At 1,000 teachers, you're looking at $500-2,000/month in AI costs with no billing to recover it. Need a cost model before scaling.

**Risk #4: No Tests.** Zero test coverage means any change to the codebase could break existing features silently. The bellringer generator, lesson plan parser, and material generator are complex enough to warrant unit tests at minimum.

**Risk #5: Single Point of Failure.** One Supabase project, one Vercel deployment, no monitoring, no alerting, no backup strategy. Supabase free tier has no SLA. If the database goes down during a school day, every teacher's morning bellringer is gone.

---

## 10. Prioritized Roadmap

### TIER 1: Fix Now (Before Any New Users)

| # | Item | Effort | Why |
|---|------|--------|-----|
| 1 | **Add Supabase Auth** (email/password login) | 3-5 days | Nothing else matters without this. |
| 2 | **Add `user_id` to all tables + real RLS policies** | 2-3 days | Secure data isolation. |
| 3 | **Auth middleware on all API routes** | 1-2 days | Prevent unauthenticated access. |
| 4 | **Move API keys to server-only env vars** | 0.5 days | Stop storing secrets in the client-accessible settings table. |
| 5 | **Add file upload size limits** | 0.5 days | Prevent memory exhaustion. |
| 6 | **Add OAuth state parameter validation** | 0.5 days | Fix CSRF vulnerability. |

**Total: ~8-12 days of focused work.**

### TIER 2: Fix Soon (Before Scaling Past 10 Users)

| # | Item | Effort | Why |
|---|------|--------|-----|
| 7 | **Add test suite** (Jest + React Testing Library) | 3-5 days | Prevent regressions as team grows. |
| 8 | **Add onboarding wizard** | 2-3 days | New teachers need guided setup. |
| 9 | **Mobile responsive overhaul** | 3-5 days | Teachers check from phones. Spec requires it. |
| 10 | **Add pagination to all list endpoints** | 1-2 days | Prevent slow loads with data growth. |
| 11 | **Add loading states / skeleton screens** | 1-2 days | Teacher shouldn't see blank screen. |
| 12 | **Rate limiting on AI endpoints** | 1 day | Prevent abuse and cost overruns. |
| 13 | **Error boundaries + consistent toast feedback** | 1-2 days | Every action needs feedback. |
| 14 | **Simplify navigation** | 1 day | 9 items → 4 primary + sub-pages. |

**Total: ~15-22 days.**

### TIER 3: Build for v3 (Product Expansion)

| # | Item | Effort | Why |
|---|------|--------|-----|
| 15 | **Organization/school-level tenancy** | 5-7 days | Multiple teachers per school. |
| 16 | **Role-based access** (teacher, principal, admin) | 3-5 days | Principal portal needs real auth. |
| 17 | **Curriculum engine schema** | 3-5 days | Standards hierarchy, scope & sequence. |
| 18 | **Slide presentation system** | 5-10 days | Beyond bellringers — full lesson slides. |
| 19 | **Live game hosting** (Supabase Realtime) | 5-10 days | Jeopardy, quizzes with student devices. |
| 20 | **Student accounts + response tracking** | 5-10 days | FERPA compliance required. |
| 21 | **Parent portal** | 3-5 days | Read-only view of student progress. |
| 22 | **AI cost management** (usage tracking, quotas) | 2-3 days | Must track before billing. |
| 23 | **Monitoring + alerting** (Sentry, Vercel Analytics) | 1-2 days | Know when things break. |
| 24 | **CI/CD pipeline** (GitHub Actions) | 1-2 days | Automated tests, linting, deploy. |

### TIER 4: Polish (Consumer-Grade Product)

| # | Item | Effort | Why |
|---|------|--------|-----|
| 25 | **Brand identity + visual design system** | 5-10 days | Logo, color system, typography, illustrations. |
| 26 | **WCAG 2.1 AA accessibility audit** | 3-5 days | Legal requirement for edu products. |
| 27 | **Internationalization framework** | 2-3 days | Not just languages — date formats, curricula. |
| 28 | **Offline/PWA support** | 3-5 days | School WiFi is unreliable. |
| 29 | **Performance budget + bundle optimization** | 2-3 days | First load matters on slow networks. |
| 30 | **Externalize AI prompts** | 2-3 days | Version, A/B test, and iterate without deploys. |

---

## Appendix: File-by-File Risk Assessment

### Red (Fix Immediately)
- `src/lib/db.ts` — Supabase anon key with no RLS = open database
- `src/lib/ms-graph.ts` — OAuth tokens and client secret stored in open settings table
- `src/lib/ai-service.ts` — API keys readable from settings table via anon key
- `supabase/schema.sql` — Every RLS policy is `USING (true)`

### Yellow (Fix Before Scaling)
- `src/lib/context-engine.ts` — N+1 query pattern, no caching
- `src/lib/standards-tagger.ts` — Standards fetched per-activity, no cache
- `src/app/api/calendar/import-csv/route.ts` — Custom CSV parser, no size limits
- `src/app/api/bellringers/upload-image/route.ts` — No file size validation
- `src/app/api/lesson-plans/import/route.ts` — No file size validation
- `src/app/api/plans/[token]/comments/route.ts` — No rate limiting, spam-able
- `scripts/import-lesson-plans.js` — Hardcoded credentials

### Green (Solid, Keep As-Is)
- `src/lib/bellringer-generator.ts` — Well-structured, good prompts
- `src/lib/export-service.ts` — Proper escaping, clean output
- `src/lib/task-helpers.ts` — Excellent natural language parsing
- `src/lib/material-generator.ts` — Clean provider-agnostic design
- `src/lib/material-exporter.ts` — Solid DOCX generation
- `src/lib/subdash-generator.ts` — Comprehensive, well-bounded queries
- `src/app/display/[date]/page.tsx` — Polished TV display
- `src/components/Navigation.tsx` — Clean, responsive sidebar
- `src/data/*.json` — Well-structured seed data

---

## Final Thoughts

This codebase punches way above its weight. A single developer (with Claude Code) built a fully functional teaching operating system in roughly a week. The AI integration is genuinely sophisticated — the context engine, the dual-provider abstraction, the bellringer feedback loop, the natural language task parsing. These are features that large edtech companies would take quarters to ship.

The path to a real product is clear:

1. **Lock it down** (auth, RLS, secrets management)
2. **Harden it** (tests, error handling, loading states, monitoring)
3. **Make it beautiful** (mobile, onboarding, brand, accessibility)
4. **Expand it** (multi-tenant, roles, curriculum engine, live games)

The foundation is sound. The product instincts are excellent. The technical debt is manageable. This can become a real company.

— CTO
