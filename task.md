# IPC.ai — Task Tracking Checklist

Track the implementation status of all components, data expansions, and feature completions according to the problem statement (`ps.md`).

---

## 🚀 Phase 1: Immediate Workflow & UI Fixes (Quick Wins) — [COMPLETED]
- [x] **1.1 Finalized FIR PDF Download on Mobile**
  - [x] Create backend streaming endpoint `GET /fir/{id}/pdf/stream` in `backend/src/api/fir.py`.
  - [x] Add `Download Official FIR PDF` button in `mobile/app/(tabs)/fir/[id].tsx` when `fir.status === 'finalized'`.
  - [x] Connect button to backend stream endpoint using device browser / linking.
- [x] **1.2 AI Section Suggester in FIR Drafting**
  - [x] Add `POST /legal/suggest-sections` endpoint in `backend/src/api/legal.py` using Gemini/Groq cascading LLM.
  - [x] Add `Suggest Applicable Sections with AI` button in Step 3 of `mobile/app/(tabs)/fir/new.tsx`.
  - [x] Auto-populate suggested BNS/IPC sections into the input field and display legal rationale cards.
- [x] **1.3 Audit Trail Timeline in FIR Detail**
  - [x] Add `GET /fir/{id}/audit` endpoint in `backend/src/api/fir.py`.
  - [x] Render chronological history (Created -> Submitted -> Approved -> Finalized) in `mobile/app/(tabs)/fir/[id].tsx`.

---

## 👤 Phase 2: Citizen Complaint & Tracking Module — [COMPLETED]
- [x] **2.1 Backend Complaint Schema & Endpoints**
  - [x] Create `Complaint` model in `backend/src/models/complaint.py` (`complaints` table in Supabase).
  - [x] Register model in `backend/src/models/__init__.py`.
  - [x] Create `POST /complaints` (Citizen submits complaint with incident facts).
  - [x] Create `GET /complaints/my` (Citizen tracks submitted complaint status).
  - [x] Create `GET /complaints` (Police officers view assigned/station complaints).
  - [x] Create `POST /complaints/{id}/convert-to-fir` (Sub-Inspector converts complaint into FIR draft).
  - [x] Register `complaints_router` in `backend/src/api/__init__.py` and `backend/src/main.py`.
- [x] **2.2 Mobile UI for Complaints**
  - [x] Create Citizen Complaint screen `mobile/app/complaints.tsx` with step-by-step incident form.
  - [x] Implement live complaint status tracking tab.
  - [x] Implement Sub-Inspector review queue with 1-click "Convert to FIR Draft" button.
  - [x] Add entry point in `mobile/app/(tabs)/more.tsx`.

---

## ⚖️ Phase 3: Automatic Procedural Suggestions Engine (BNSS) — [COMPLETED]
- [x] **3.1 Backend Procedural Reasoning Service**
  - [x] Create `GET /fir/{id}/procedural-suggestions` in `backend/src/api/fir.py`.
  - [x] Implement BNSS legal reasoning rules:
    - [x] Cognizability and bailability analysis.
    - [x] Section 35 BNSS arrest checklist (<= 7 yrs vs > 7 yrs notice requirements).
    - [x] Forensic inspection requirements (mandatory forensics under BNSS s. 176(3) for offences >= 7 yrs).
    - [x] Medical examination timelines (ss. 51-53 BNSS).
    - [x] Case diary entry and remand deadlines (s. 187 BNSS).
- [x] **3.2 Mobile Procedural Suggestions Card**
  - [x] Render an interactive "Procedural Guidance (BNSS)" card in `mobile/app/(tabs)/fir/[id].tsx`.
  - [x] Add interactive checkboxes and completion progress counter for investigating officers.

---

## 📚 Phase 4: Legal Dictionary & Data Expansion — [COMPLETED]
- [x] **4.1 Backend Database Legal Dictionary**
  - [x] Create `LegalDictionary` model in `backend/src/models/dictionary.py`.
  - [x] Create `GET /dictionary` search, category filter, and autocomplete in `backend/src/api/dictionary.py`.
  - [x] Register `LegalDictionary` in `backend/src/models/__init__.py`.
  - [x] Register `dictionary_router` in `backend/src/api/__init__.py` and `backend/src/main.py`.
  - [x] Seed 23+ comprehensive legal terms (Bail, Cognizable, Remand, Dying Declaration, Anticipatory Bail, Default Bail, Discharge, Acquittal, Confession, Inquest, etc.) in Supabase.
- [x] **4.2 Mobile Dynamic Dictionary Integration**
  - [x] Replace 7 hardcoded items in `mobile/app/(tabs)/index.tsx` with dynamic `GET /dictionary?q=` query.
  - [x] Add category filter pills (All, Criminal Procedure, Bail & Custody, Evidence Law, Substantive Law, Constitutional Law, FIR & Investigation).
  - [x] Display rich modal cards with Simple Explanation, Related Sanhita Sections, and Practical Examples.
- [x] **4.3 Sanhita Mappings Dataset Expansion**
  - [x] Expand `backend/data/section_mappings.json` to 56 high-frequency Indian criminal law sections:
    - [x] Offences against human body (BNS 106 hit-and-run, BNS 109 attempt to murder, BNS 114-118 hurt & grievous hurt).
    - [x] Offences against property (BNS 303 theft & community service, BNS 305 dwelling theft, BNS 308-310 extortion/robbery/dacoity, BNS 316 criminal breach of trust).
    - [x] Offences against women & children (BNS 74-79 modesty outrage, sexual harassment, stalking, insult to modesty).
    - [x] New offences (Snatching BNS 304, Organized Crime BNS 111, Mob Lynching BNS 103(2), Terrorist Acts BNS 113).
    - [x] CrPC $\leftrightarrow$ BNSS procedural mappings (Audio-video search & seizure BNSS 105, witness exam BNSS 180, confessions BNSS 183, remand BNSS 187, charge sheet BNSS 193, anticipatory bail BNSS 482, inherent powers BNSS 528).
    - [x] IEA $\leftrightarrow$ BSA evidence mappings (Electronic records BSA 63, confessions to police & recovery BSA 23).
  - [x] Synchronized all 56 section mappings into Supabase database.

---

## 💼 Phase 5: Lawyer Workspace Features — [COMPLETED]
- [x] **5.1 Lawyer Case Notes & Bookmarks Backend**
  - [x] Create `LawyerCaseNote` and `LawyerBookmark` models in `backend/src/models/lawyer_workspace.py`.
  - [x] Register models in `backend/src/models/__init__.py`.
  - [x] Create CRUD endpoints in `backend/src/api/lawyer_workspace.py`:
    - [x] `POST /lawyer/notes`, `GET /lawyer/notes`, `GET /lawyer/notes/{id}`, `PUT /lawyer/notes/{id}`, `DELETE /lawyer/notes/{id}`.
    - [x] `POST /lawyer/bookmarks`, `GET /lawyer/bookmarks`, `DELETE /lawyer/bookmarks/{id}`.
  - [x] Register router in `backend/src/api/__init__.py` and `backend/src/main.py`.
  - [x] Verified tables and operations in Supabase PostgreSQL.
- [x] **5.2 Mobile Lawyer Workspace UI**
  - [x] Add "Case Diary" tab in `mobile/app/lawyers.tsx` with trial hearing notes, client name, sections, and argument points.
  - [x] Add "Precedents" tab in `mobile/app/lawyers.tsx` for bookmarked judgments and statutory rulings.
  - [x] Integrate "Add Case Note" and "Bookmark Precedent" modals with full CRUD actions and delete confirmations.

---

## 🧪 Phase 6: System Verification & Health — [COMPLETED]
- [x] Automated backend endpoint tests verified with 100% pass rate.
- [x] Supabase tables (`legal_dictionary`, `lawyer_case_notes`, `lawyer_bookmarks`, `complaints`, `section_mapping`) verified.
- [x] Token lookup verified for both user ID and email credentials.
