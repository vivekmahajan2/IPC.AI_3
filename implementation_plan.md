# IPC.ai — Comprehensive Implementation Plan & Gap Remediation Roadmap

## Executive Summary

Based on a thorough system audit of the IPC.ai codebase against the Problem Statement ([`ps.md`](file:///d:/Code/vivek/IPC.AI_2/ps.md)), this document outlines the end-to-end architectural implementation plan to bring all modules, data sets, workflows, and integrations into a fully operational, production-grade state.

---

## 1. System Architecture & Infrastructure Alignments

### 1.1 Database: Supabase PostgreSQL (Remote Cloud)
- **Engine**: PostgreSQL 15+ hosted on Supabase (`db.aaexeshzfonwpuaohsxl.supabase.co:5432`).
- **Driver**: `asyncpg` with SQLAlchemy 2.0 async engine (`postgresql+asyncpg://...`).
- **Status**: Replaced all legacy local SQLite dependencies. Schema tables are synchronized via `init_db()` and Alembic migrations.

### 1.2 LLM Engine: Multi-Tier Cascading Architecture
- **Primary**: Google Gemini API:
  - `gemini-3.7-flash` (High-speed multi-step legal reasoning)
  - `gemini-3.6-flash` / `gemini-3.5-flash` / `gemini-2.5-flash` (Auto fallback on quota/rate limits)
- **Secondary / Fallback**: Groq Cloud:
  - `groq/compound` (Compound reasoning)
  - `groq/compound-mini` / `llama-3.3-70b-versatile` / `openai/gpt-oss-120b` (Resilient fallbacks)
- **Status**: Implemented in [`backend/src/services/rag_service.py`](file:///d:/Code/vivek/IPC.AI_2/backend/src/services/rag_service.py).

### 1.3 Storage & Artifacts
- **Cloudflare R2**: Clarified as **optional**; ReportLab-generated FIR PDFs stream dynamically via `GET /fir/{fir_id}/pdf/stream` directly to the client without requiring external S3/R2 credentials.

---

## 2. Gap Analysis Summary (From Project Scan)

| Module / Requirement | Problem Statement (`ps.md`) Expectation | Audit Finding | Status |
|---|---|---|---|
| **FIR PDF Export** | Officers & superiors must download signed/finalized FIR PDFs | Endpoint existed but mobile UI lacked download trigger | ✅ **Completed** (Phase 1) |
| **AI Section Suggester** | Auto-recommend sections during FIR drafting based on narrative | RAG existed for Q&A, but no dedicated FIR suggestion hook | ✅ **Completed** (Phase 1) |
| **FIR Audit Trail** | Chain of custody from creation to superior approval | Backend logged actions, but mobile detail lacked visual timeline | ✅ **Completed** (Phase 1) |
| **Citizen Complaints** | Public users file complaints; officers track & convert to FIR | No complaint model or public desk existed | ✅ **Completed** (Phase 2) |
| **Procedural Guidance** | BNSS arrest checklist, forensics rule s.176(3), medical timeline | Logic was absent from backend and mobile | ✅ **Completed** (Phase 3) |
| **Legal Dictionary** | Comprehensive legal terminology & definitions with search | Mobile had only 7 hardcoded mock terms in UI | 🟡 **In Progress** (Phase 4) |
| **Sanhita Dataset** | Full IPC $\leftrightarrow$ BNS, CrPC $\leftrightarrow$ BNSS, IEA $\leftrightarrow$ BSA mappings | Only ~28 starter sections in JSON | 🟡 **In Progress** (Phase 4) |
| **Lawyer Workspace** | Case notes, bookmarking judgment citations for legal advocates | Lawyer directory existed, but personal workspace was missing | ⏳ **Queued** (Phase 5) |

---

## 3. Detailed 5-Phase Implementation Plan

```
┌─────────────────────────────────────────────────────────┐
│ Phase 1: Immediate Workflow & UI Fixes                 │ ✅ COMPLETED
│ - PDF download & streaming on mobile                   │
│ - AI Section Suggester during FIR drafting              │
│ - Visual audit trail timeline in FIR detail             │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│ Phase 2: Citizen Complaint & Tracking Module            │ ✅ COMPLETED
│ - Supabase `complaints` table & backend API             │
│ - Citizen filing & live status tracking screen          │
│ - Sub-Inspector 1-click "Convert to FIR Draft"          │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│ Phase 3: Automatic Procedural Suggestions Engine        │ ✅ COMPLETED
│ - BNSS arrest rules (s. 35, <=7 vs >7 years)            │
│ - Mandatory forensic dispatch rules (s. 176(3) BNSS)    │
│ - Medical examination & case diary remand schedules     │
│ - Interactive officer checklist in FIR detail           │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│ Phase 4: Legal Dictionary & Data Expansion             │ 🟡 IN PROGRESS
│ - Register `LegalDictionary` model & `dictionary_router`│
│ - Auto-seeding 100+ criminal law terms & definitions    │
│ - Dynamic mobile search & category filter modal         │
│ - Expand `section_mappings.json` to 150+ core sections  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│ Phase 5: Lawyer Workspace Features                      │ ⏳ QUEUED
│ - `case_notes` & `legal_bookmarks` tables in Supabase   │
│ - CRUD API in `backend/src/api/lawyer_workspace.py`     │
│ - Mobile Case Notes & Saved Precedents management UI    │
└─────────────────────────────────────────────────────────┘
```

---

### Phase 1: Immediate Workflow & UI Fixes (Completed)

1. **FIR PDF Streaming & Mobile Download**:
   - Backend: Added `GET /fir/{fir_id}/pdf/stream` in [`backend/src/api/fir.py`](file:///d:/Code/vivek/IPC.AI_2/backend/src/api/fir.py) to stream generated ReportLab bytes directly with `application/pdf` headers.
   - Mobile: Added "Download Official FIR PDF" button in [`mobile/app/(tabs)/fir/[id].tsx`](file:///d:/Code/vivek/IPC.AI_2/mobile/app/%28tabs%29/fir/%5Bid%5D.tsx) using `Linking.openURL` targeting the backend stream endpoint.
2. **AI Section Suggester in FIR Drafting**:
   - Backend: Added `POST /legal/suggest-sections` in [`backend/src/api/legal.py`](file:///d:/Code/vivek/IPC.AI_2/backend/src/api/legal.py) leveraging Gemini/Groq cascading LLMs to analyze incident narratives and return recommended BNS/IPC sections with rationale.
   - Mobile: Added "Suggest Applicable Sections with AI" button in Step 3 of [`mobile/app/(tabs)/fir/new.tsx`](file:///d:/Code/vivek/IPC.AI_2/mobile/app/%28tabs%29/fir/new.tsx) with automatic input population and rationale cards.
3. **Audit Trail Timeline in FIR Detail**:
   - Backend: Added `GET /fir/{fir_id}/audit` in [`backend/src/api/fir.py`](file:///d:/Code/vivek/IPC.AI_2/backend/src/api/fir.py) returning timestamped chronological audit events.
   - Mobile: Added interactive collapsible Audit Trail card in [`mobile/app/(tabs)/fir/[id].tsx`](file:///d:/Code/vivek/IPC.AI_2/mobile/app/%28tabs%29/fir/%5Bid%5D.tsx) showing created, submitted, approved, and finalized lifecycle steps.

---

### Phase 2: Citizen Complaint & Tracking Module (Completed)

1. **Backend Database Schema**:
   - Created `Complaint` model in [`backend/src/models/complaint.py`](file:///d:/Code/vivek/IPC.AI_2/backend/src/models/complaint.py) supporting:
     - `complaint_number` (Unique auto-generated e.g. `CMP-20260918-XXXX`),
     - `complainant_name`, `phone`, `email`, `aadhaar_last4`,
     - `incident_details` (JSON: date, time, place, description, accused, witnesses),
     - `status`: `submitted`, `under_inquiry`, `converted_to_fir`, `closed`,
     - `fir_id` (foreign key link to created `fir_drafts.id`).
2. **API Endpoints**:
   - Created [`backend/src/api/complaints.py`](file:///d:/Code/vivek/IPC.AI_2/backend/src/api/complaints.py) with:
     - `POST /complaints` (Public filing),
     - `GET /complaints/my` (Citizen tracking),
     - `GET /complaints` (Police station inquiry queue),
     - `POST /complaints/{id}/convert-to-fir` (Sub-Inspector converts complaint into FIR draft).
3. **Mobile User Interface**:
   - Created dedicated screen [`mobile/app/complaints.tsx`](file:///d:/Code/vivek/IPC.AI_2/mobile/app/complaints.tsx) with tabs for "File New Complaint", "Track My Complaints", and "Police Review Queue".
   - Added direct entry point in [`mobile/app/(tabs)/more.tsx`](file:///d:/Code/vivek/IPC.AI_2/mobile/app/%28tabs%29/more.tsx).

---

### Phase 3: Automatic Procedural Suggestions Engine (Completed)

1. **Statutory Procedural Logic (BNSS)**:
   - Implemented `GET /fir/{fir_id}/procedural-suggestions` in [`backend/src/api/fir.py`](file:///d:/Code/vivek/IPC.AI_2/backend/src/api/fir.py) encoding:
     - **Cognizability & Bailability**: Automatic classification based on applied sections.
     - **Arrest Rules under Section 35 BNSS**: Check if maximum punishment exceeds 7 years. If $\le 7$ years, mandate Section 35(3) Notice of Appearance before arrest. If $> 7$ years, enforce Section 35(1) checklist.
     - **Mandatory Crime Scene Forensics**: Section 176(3) BNSS triggers mandatory forensic team dispatch for offences punishable with $\ge 7$ years.
     - **Victim Medical Examination**: Sections 51-53 BNSS mandatory timelines for sexual offence and assault victims.
     - **Remand & Case Diary Deadlines**: Section 187 BNSS 24-hour Magistrate production rule and 60/90 days charge-sheet timeline.
2. **Mobile Procedural Card**:
   - Added interactive "Procedural Guidance (BNSS)" card in [`mobile/app/(tabs)/fir/[id].tsx`](file:///d:/Code/vivek/IPC.AI_2/mobile/app/%28tabs%29/fir/%5Bid%5D.tsx) with live checklist checkboxes and completion counter.

---

### Phase 4: Legal Dictionary & Data Expansion (In Progress)

#### 4.1 Backend Legal Dictionary Service
- **Model**: [`backend/src/models/dictionary.py`](file:///d:/Code/vivek/IPC.AI_2/backend/src/models/dictionary.py)
  - Fields: `id`, `term`, `definition`, `simple_explanation`, `related_provisions` (JSON), `examples`, `category`, `created_at`.
- **API**: [`backend/src/api/dictionary.py`](file:///d:/Code/vivek/IPC.AI_2/backend/src/api/dictionary.py)
  - `GET /dictionary?q={term}&category={cat}&skip=0&limit=20`
  - `GET /dictionary/{term_name}`
  - Pre-seeded with 12 foundational terms (Cognizable, Non-Cognizable, Bail, Anticipatory Bail, Zero FIR, Charge Sheet, Inquest, Dying Declaration, Mens Rea, Remand, Habeas Corpus, Quashing of FIR) with fallback auto-seeding.
- **Pending Tasks**:
  1. Register `LegalDictionary` in [`backend/src/models/__init__.py`](file:///d:/Code/vivek/IPC.AI_2/backend/src/models/__init__.py).
  2. Register `dictionary_router` in [`backend/src/api/__init__.py`](file:///d:/Code/vivek/IPC.AI_2/backend/src/api/__init__.py) and [`backend/src/main.py`](file:///d:/Code/vivek/IPC.AI_2/backend/src/main.py).
  3. Expand initial dataset with 50+ additional terms across Criminal Law, Constitutional Law, Evidence, and Procedure.

#### 4.2 Mobile UI Dynamic Dictionary Integration
- Replace the 7 hardcoded items in [`mobile/app/(tabs)/index.tsx`](file:///d:/Code/vivek/IPC.AI_2/mobile/app/%28tabs%29/index.tsx) with:
  - Asynchronous search to `GET /dictionary?q={term}`.
  - Category filter pills (All, Criminal Procedure, Bail & Custody, Evidence Law, Constitutional Law).
  - Rich card display showing simple explanation, related acts/sections, and practical examples.

#### 4.3 Sanhita Mappings Expansion
- Expand [`backend/data/section_mappings.json`](file:///d:/Code/vivek/IPC.AI_2/backend/data/section_mappings.json) from ~28 entries to 150+ high-frequency sections:
  - Offences against Human Body (BNS 100-144 vs IPC 299-377)
  - Offences against Property (BNS 303-334 vs IPC 378-462)
  - Offences against Women and Children (BNS 63-99 vs IPC 354, 375, 498A, 509)
  - Public Tranquility & State (BNS 189-197 vs IPC 141-160)
  - New Offences: Snatching (BNS 304), Organized Crime (BNS 111), Mob Lynching (BNS 103(2)), Terrorist Acts (BNS 113)
  - CrPC $\leftrightarrow$ BNSS procedural mappings (Arrest, Remand, Bail, Charge Sheet, Trial procedures)
  - IEA $\leftrightarrow$ BSA evidence mappings (Electronic evidence s. 61-63 BSA vs s. 65B IEA).

---

### Phase 5: Lawyer Workspace Features (Queued)

#### 5.1 Backend Schema & API
- **Model**: `backend/src/models/lawyer_workspace.py`
  - `case_notes`: `id`, `user_id`, `case_title`, `court_name`, `case_number`, `sections_involved`, `client_name`, `notes_content`, `created_at`, `updated_at`.
  - `legal_bookmarks`: `id`, `user_id`, `item_type` (`judgment`, `statute_section`, `other_law`), `item_id`, `title`, `citation`, `notes`, `created_at`.
- **API**: `backend/src/api/lawyer_workspace.py`
  - `POST /lawyer/notes` & `GET /lawyer/notes` & `PUT /lawyer/notes/{id}` & `DELETE /lawyer/notes/{id}`
  - `POST /lawyer/bookmarks` & `GET /lawyer/bookmarks` & `DELETE /lawyer/bookmarks/{id}`
- Register router in `src/main.py`.

#### 5.2 Mobile UI Integration
- Add "Advocate Workspace" section in `mobile/app/lawyers.tsx` or `mobile/app/(tabs)/more.tsx`:
  - "My Case Diary & Notes": Create/edit trial notes, key witness testimonies, arguments.
  - "Bookmarked Precedents": View saved High Court / Supreme Court judgments with personal annotations.

---

## 4. Verification & Testing Plan

### 4.1 Automated API Verification
- Run test suite:
  ```powershell
  cd backend
  python -m pytest tests/ -v
  ```
- Endpoint Health & Schema Validation Script:
  - Test `GET /dictionary` with query and category filters.
  - Test `POST /complaints` and `POST /complaints/{id}/convert-to-fir`.
  - Test `GET /fir/{id}/procedural-suggestions`.
  - Test `GET /fir/{id}/pdf/stream`.

### 4.2 Frontend Verification
- Metro bundler compilation:
  ```powershell
  cd mobile
  npm run start -- --reset-cache
  ```
- Visual inspection on mobile web / Expo Go:
  - Open Law Dictionary modal, search "cognizable", "bail", "remand", verify dynamic backend response renders.
  - Open Citizen Complaints screen, submit a mock complaint, verify complaint number is generated.
  - In Police view, verify complaint is converted into an FIR draft with populated fields.
  - Open FIR detail, test BNSS procedural checklist items and audit log history.
  - Download FIR PDF stream.
