# Copilot instructions for StoryRAG

## Build, lint, and test commands

Run from repository root unless noted.

| Area | Command | Notes |
|---|---|---|
| Frontend install | `cd Frontend && npm install` | Required before first frontend run |
| Frontend dev | `cd Frontend && npm run dev` | Vite dev server |
| Frontend lint | `cd Frontend && npm run lint` | Uses `eslint.config.js` |
| Frontend build | `cd Frontend && npm run build` | Production bundle |
| Backend restore/build | `cd Backend && dotnet restore && dotnet build Backend.sln` | Builds Api + Service + Repository |
| Backend run | `cd Backend && dotnet run --project Api` | Starts ASP.NET Core API |
| Backend tests (full) | `cd Backend && dotnet test Backend.sln` | Repository currently has no dedicated test project yet |
| Backend single test (when tests exist) | `cd Backend && dotnet test Backend.sln --filter "FullyQualifiedName~Namespace.ClassName.MethodName"` | Use this format for one test case |

## MCP servers

- Workspace MCP config is committed at `.vscode/mcp.json`.
- Configured server: `playwright` via `npx -y @microsoft/mcp-server-playwright`.
- Use it for end-to-end checks of frontend routes/flows (auth, workspace editing, AI panels) in real browser context.

## High-level architecture

- The repo is a two-app monorepo:
  - `Backend/` is a .NET 8 solution with 3 layers/projects: `Api` (controllers + DI), `Service` (business/AI logic), `Repository` (EF Core entities + `AppDbContext` + migrations).
  - `Frontend/` is a React 19 + Vite + TypeScript SPA with page-level routing and API service modules in `src/services`.
- Data path for writing and RAG:
  1. In `WorkspacePage`, save updates the active chapter version in place (`PUT /projects/{projectId}/chapters/{chapterId}`).
  2. After save, frontend triggers background chunking then embedding (`POST .../chunk` then `POST /ai/chapters/{chapterId}/embed`), and UI shows sync state (`syncing`/`ready`/`error`).
  3. AI chat embeds the question, retrieves nearest vectors from **active chapter versions** plus Story Bible tables, builds a guarded prompt, then calls Gemini.
- Storage model combines encrypted text + vector search:
  - Most user-authored content is encrypted per user (DEK encrypted by master key).
  - Vector fields are `vector(768)` in Postgres/pgvector (`ChapterChunks`, `WorldbuildingEntries`, `CharacterEntries`, `StyleGuideEntries`, `ThemeEntries`, `PlotNoteEntries`).
- Routing and access control:
  - Frontend protects routes via `RouteGuard` and role checks via `RoleGuard`.
  - Backend endpoints are JWT-protected and re-check project ownership in services before data access.

## Key conventions specific to this codebase

- **Project-scoped routes use plural prefix**: use `/api/projects/{projectId}/...` for project resources.
- **Project ownership is enforced in service layer** (`VerifyOwnershipAsync` / ownership queries) for project-scoped operations; do not rely on route params alone.
- **Encryption/decryption is a first-class rule**: services encrypt before persistence and decrypt before returning DTOs. Keep enum-like metadata (category/role/type) in clear text only when query/filter semantics require it.
- **Embedding input format is standardized**:
  - documents use `search_document: ...`
  - queries use `search_query: ...`
  - `EmbeddingService` auto-prefixes when missing.
- **Prompt-safety pipeline is built in** for AI features:
  - sanitize user/context text with `PromptSanitizer`
  - validate model output with `LlmOutputValidator`
  - Gemini retry behavior uses `GeminiRetryHelper` (429 backoff).
- **Chapter version behavior matters to downstream AI**:
  - autosave edits current active version (not a new version)
  - max 20 versions per chapter, oldest non-pinned versions are pruned
  - AI retrieval/analyze flows operate on embedded chunks of active versions.
- **Database bootstrap convention**: for initial/reset setup, use `Backend/supabase_full_reset.sql`; this repo treats schema/history as pre-seeded rather than relying on `dotnet ef database update` for first-time setup.
- **Frontend API base URL is env-driven**: `src/services/api.ts` uses `VITE_API_BASE_URL` (fallback is `https://localhost:7259/api`).
- **Environment config naming follows ASP.NET double-underscore convention** (e.g., `ConnectionStrings__DefaultConnection`, `Gemini__ChatApiKey`, `Security__MasterKey`) as seen in deployment config.
