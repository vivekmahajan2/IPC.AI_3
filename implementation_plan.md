# IPC.ai — Implementation Plan

## Overview

IPC.ai is a mobile-first legal assistant for Indian police officers, law students, and legal professionals. It includes:

- **Expo (React Native)** mobile app with offline-capable FIR drafting, Sanhita Converter, AI legal assistant, judgments search, and lawyer directory.
- **FastAPI** backend with PostgreSQL + pgvector, JWT auth, Groq LLM integration, and Cloudflare R2 storage.

The app uses a **simple UI with a light theme** as requested.

---

## User Review Required

> [!IMPORTANT]
> This is a massive project (~8 weeks per your spec). I'll scaffold the full project structure but implement modules incrementally. **Phase 1 below covers the foundational skeleton** — project setup, auth, navigation, core UI, and the FIR module. Subsequent phases will be built on top.

> [!WARNING]
> **API keys & secrets**: You'll need to provide or configure:
> - PostgreSQL connection string
> - Groq API key
> - Cloudflare R2 credentials (access key, secret, bucket name)
> - JWT secret key
>
> I'll use placeholder `.env` files that you can fill in.

> [!IMPORTANT]
> **Simple UI + Light Theme**: Per your request, I'll use a clean, professional light theme with subtle accent colors (Indian tricolor-inspired blue/saffron accents). NativeWind (Tailwind) for styling as specified in your tech stack.

---

## Open Questions

1. **Registration flow**: Should police officers self-register, or are accounts created by admins only? The spec says `/auth/register` is admin-only — I'll implement it that way.
2. **FIR template fields**: What specific fields does `incident_details` JSON contain? I'll use a standard Indian FIR format (date, time, place, complainant info, accused info, description, sections applied).
3. **Section mappings data**: Do you have the `section_mappings.json` file with IPC↔BNS, CrPC↔BNSS, IEA↔BSA data? I can create a starter dataset with common sections, but the full mapping requires the official MHA notification data.
4. **Groq model preference**: Mixtral or LLaMA 3? I'll default to `llama-3.1-70b-versatile` which has good legal reasoning.

---

## Proposed Changes

The project will be split into two top-level directories:

```
IPC.AI_@2/
├── mobile/          # Expo (React Native) app
└── backend/         # FastAPI server
```

---

### Phase 1: Project Foundation (Current Scope)

This phase sets up both projects, implements auth, navigation, and the FIR module.

---

### Mobile App (Expo + React Native)

#### [NEW] `mobile/` — Expo project scaffolding

Initialize with `npx create-expo-app` using Expo Router template. Key files:

#### [NEW] [package.json](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/mobile/package.json)
- Dependencies: expo, expo-router, nativewind, tailwindcss, @tanstack/react-query, expo-sqlite, expo-secure-store, axios

#### [NEW] [app/_layout.tsx](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/mobile/app/_layout.tsx)
- Root layout: Stack navigator wrapping auth check → Tab navigator
- TanStack QueryClientProvider
- Auth context provider

#### [NEW] [app/(auth)/login.tsx](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/mobile/app/(auth)/login.tsx)
- Login screen with email/password
- JWT token storage in SecureStore

#### [NEW] [app/(tabs)/_layout.tsx](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/mobile/app/(tabs)/_layout.tsx)
- Bottom tab navigator with icons: Home, AI, FIR, Converter, More

#### [NEW] [app/(tabs)/home.tsx](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/mobile/app/(tabs)/home.tsx)
- Dashboard with stats cards (total FIRs, pending reviews, recent activity)
- Quick action buttons

#### [NEW] [app/(tabs)/assistant.tsx](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/mobile/app/(tabs)/assistant.tsx)
- Chat interface for AI legal Q&A
- Message bubbles with source citations

#### [NEW] [app/(tabs)/fir/index.tsx](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/mobile/app/(tabs)/fir/index.tsx)
- FIR list with status filters (Draft, Submitted, Approved, etc.)

#### [NEW] [app/(tabs)/fir/new.tsx](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/mobile/app/(tabs)/fir/new.tsx)
- FIR creation form with offline save to SQLite

#### [NEW] [app/(tabs)/fir/[id].tsx](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/mobile/app/(tabs)/fir/[id].tsx)
- View/edit FIR, review actions for superiors

#### [NEW] [app/(tabs)/converter.tsx](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/mobile/app/(tabs)/converter.tsx)
- Bidirectional section converter with search
- Works offline using SQLite-cached mappings

#### [NEW] [app/(tabs)/judgments/index.tsx](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/mobile/app/(tabs)/judgments/index.tsx)
- Searchable judgment list with court/year filters

#### [NEW] [app/(tabs)/judgments/[id].tsx](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/mobile/app/(tabs)/judgments/[id].tsx)
- Full judgment view

#### [NEW] [app/(tabs)/lawyers/index.tsx](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/mobile/app/(tabs)/lawyers/index.tsx)
- Lawyer directory with specialization filters

#### [NEW] [app/(tabs)/lawyers/[id].tsx](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/mobile/app/(tabs)/lawyers/[id].tsx)
- Lawyer profile with contact details

#### [NEW] [app/(tabs)/history.tsx](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/mobile/app/(tabs)/history.tsx)
- Search/action history log

#### [NEW] [app/(tabs)/profile.tsx](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/mobile/app/(tabs)/profile.tsx)
- User profile, role display, settings

#### [NEW] Core libraries & hooks:

| File | Purpose |
|------|---------|
| `lib/api.ts` | Axios instance with JWT interceptors, base URL config |
| `lib/db.ts` | SQLite helper (init tables, CRUD for offline FIRs, mappings) |
| `lib/auth.ts` | SecureStore JWT get/set/clear |
| `hooks/useAuth.ts` | Auth context hook (login, logout, current user) |
| `hooks/useOfflineSync.ts` | Sync SQLite drafts to server when online |
| `hooks/useMappings.ts` | Load/search section mappings from SQLite |
| `context/ThemeContext.tsx` | Dynamic light/dark theme provider with SecureStore persistence |
| `components/` | Reusable: Card, Button, Input, Badge, ChatBubble, StatusBadge, Header |
| `types/` | TypeScript interfaces for User, FIR, Mapping, Judgment, Lawyer, etc. |
| `constants/theme.ts` | Light and Dark theme color palettes, typography |

---

### Backend (FastAPI)

#### [NEW] `backend/` — FastAPI project

#### [NEW] [requirements.txt](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/backend/requirements.txt)
```
fastapi[all]
uvicorn
sqlalchemy[asyncio]
asyncpg
alembic
python-jose[cryptography]
passlib[bcrypt]
pydantic-settings
pgvector
httpx
groq
reportlab
boto3
python-multipart
```

#### [NEW] [src/core/config.py](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/backend/src/core/config.py)
- Pydantic Settings: DATABASE_URL, JWT_SECRET, GROQ_API_KEY, R2 credentials

#### [NEW] [src/core/database.py](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/backend/src/core/database.py)
- Async SQLAlchemy engine + session factory

#### [NEW] [src/core/security.py](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/backend/src/core/security.py)
- JWT create/verify, password hashing (bcrypt)

#### [NEW] [src/core/dependencies.py](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/backend/src/core/dependencies.py)
- `get_current_user`, `require_role()` FastAPI dependencies

#### [NEW] SQLAlchemy Models (`src/models/`):

| File | Tables |
|------|--------|
| `user.py` | `users` — id, email, password_hash, role, verified, full_name, created_at |
| `fir.py` | `fir_drafts` — id, client_uuid, user_id, title, incident_details, sections_applied, status, reviewer_id, review_comments, pdf_url, timestamps |
| `audit.py` | `audit_log` — id, fir_id, user_id, action, timestamp, details |
| `mapping.py` | `section_mapping` — id, old_act, old_section, old_text, new_act, new_section, new_text, mapping_notes, is_identical, effective_date |
| `judgment.py` | `judgments` + `judgment_chunks` — with pgvector embedding columns |
| `lawyer.py` | `lawyers` — full profile with arrays for specialization, courts |
| `history.py` | `search_history` — user_id, module, query, response_summary |
| `statute.py` | `statute_chunks` — act, section, chunk_text, embedding |

#### [NEW] API Routers (`src/api/`):

| File | Endpoints |
|------|-----------|
| `auth.py` | POST `/auth/login`, `/auth/refresh`, `/auth/register`, GET `/auth/me` |
| `fir.py` | CRUD + status workflow: create, list, get, update, submit, approve, reject, finalize, get PDF |
| `legal.py` | POST `/legal/query` — RAG pipeline (embed query → pgvector search → Groq completion) |
| `compare.py` | GET `/compare` (single lookup), `/compare/bulk` (full mapping JSON gzipped) |
| `judgments.py` | GET `/judgments`, `/judgments/{id}`, `/judgments/courts` |
| `lawyers.py` | GET `/lawyers`, `/lawyers/{id}` |
| `history.py` | GET `/history`, DELETE `/history/{id}` |
| `pdf.py` | PDF generation endpoint (ReportLab) |
| `admin.py` | POST `/admin/reindex` |

#### [NEW] Services (`src/services/`):

| File | Purpose |
|------|---------|
| `fir_service.py` | FIR business logic, status transitions, audit logging |
| `rag_service.py` | Embed query, search pgvector, call Groq, format response with sources |
| `pdf_service.py` | Generate FIR PDF using ReportLab |
| `storage_service.py` | R2 upload/download, signed URL generation |
| `history_service.py` | Log and retrieve search history |

#### [NEW] [src/main.py](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/backend/src/main.py)
- FastAPI app instance, CORS middleware, router registration, startup event (DB init)

#### [NEW] [Dockerfile](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/backend/Dockerfile)
- Multi-stage build for production deployment

#### [NEW] [alembic/](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/backend/alembic/)
- Database migration setup

#### [NEW] [data/section_mappings.json](file:///c:/Users/vivek/OneDrive/Documents/vivek.phone/OneDrive/IPC.AI_@2/backend/data/section_mappings.json)
- Starter dataset with ~50 common IPC↔BNS mappings

---

## Design System (Light & Dark Theme support)

The application supports both themes, defaulting to the premium **Dark Theme** to match the Law4u screenshots.

### Light Theme
```
Primary:        #1A56DB (Royal Blue — trust, authority)
Secondary:      #E8590C (Saffron — Indian identity)
Background:     #FAFBFC
Surface:        #FFFFFF
Text Primary:   #1F2937
Text Secondary: #6B7280
Border:         #E5E7EB
Success:        #059669
Warning:        #D97706
Error:          #DC2626
```

### Dark Theme (Default)
```
Primary:        #5C93FC (Vibrant light blue accent)
Secondary:      #FF8A4D (Bright saffron accent)
Background:     #0F0F11 (Near-black)
Surface:        #1E1E22 (Slate card background)
Text Primary:   #F3F4F6 (Light gray)
Text Secondary: #9CA3AF (Secondary gray)
Border:         #2E2E34 (Dark gray border)
Success:        #10B981
Warning:        #F59E0B
Error:          #EF4444
```


---

## Execution Strategy

Given the project size, I'll build it in this order:

### Step 1 — Scaffold Both Projects
- Initialize Expo app with Router template
- Initialize FastAPI project with folder structure
- Configure NativeWind, TanStack Query, SQLite

### Step 2 — Backend Core
- Database models + Alembic migrations
- JWT auth endpoints
- FIR CRUD + status workflow
- Converter endpoints + starter mapping data

### Step 3 — Mobile Core
- Auth flow (login screen → secure token storage)
- Tab navigation with all screens
- Home dashboard
- FIR module (list, create, view/edit)
- Converter screen (offline-capable)

### Step 4 — Advanced Features
- AI Assistant (RAG pipeline)
- Judgments search
- Lawyer directory
- History
- Profile

### Step 5 — Offline & Polish
- SQLite offline sync for FIRs
- Offline mapping cache
- PDF generation
- Error handling, loading states

---

## Verification Plan

### Automated Tests
```bash
# Backend
cd backend && python -m pytest tests/ -v

# Mobile  
cd mobile && npx expo start  # Visual verification on Expo Go
```

### Manual Verification
- Run FastAPI server locally with `uvicorn src.main:app --reload`
- Run Expo app on Android emulator or Expo Go
- Test auth flow end-to-end
- Test FIR creation and status workflow
- Test converter with sample sections
- Verify offline FIR drafting works without network
