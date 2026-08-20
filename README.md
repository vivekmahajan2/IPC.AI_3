# IPC.ai — Indian Legal Assistant for Law Enforcement

**IPC.ai** is a mobile-first digital assistant tailored for Indian police officers, law students, and legal professionals. It streamlines legal processes and assists in drafting First Information Reports (FIRs), translating legal acts between old and new systems, searching legal precedents, and listing practicing lawyers.

---

## 🚀 Key Features

### 📱 Mobile Application (Expo / React Native)
- **Dynamic Theme Engine**: Persistent light and dark mode switching, defaulting to a premium dark theme. Toggled instantly from the side drawer.
- **Top Bar & Drawer Navigation**: Hamburger menu, brand logo, profile shortcut, and side drawer containing preference options (Night Mode, Language), favorites, and support links.
- **Tab Switcher (Dashboard vs Advocate)**: Dual-view hub separating daily utility operations from the lawyer search directories.
- **Core Bare Act / Sanhita Comparison**: Quick comparison grids for BNS vs IPC, BNSS vs CrPC, and BSA vs IEA linking directly to converter interfaces.
- **Our Legal AI Tools Section**: AI search endpoints including Judgment AI, Legal AI, and Draft AI helper tools.
- **Offline-capable FIR Drafting**: Create and save FIR drafts offline using an interactive step-by-step form.
- **Sanhita Converter**: Look up bidirectional mapping between old laws and new laws (e.g., IPC ↔ BNS, CrPC ↔ BNSS, IEA ↔ BSA) offline.
- **AI Legal Assistant**: Interactive chat interface powered by Retrieval-Augmented Generation (RAG) for citing legal codes and answering questions.
- **Judgments Search**: Search landmark Indian judicial precedents by citation, court name, or keywords.
- **Lawyer Directory**: Search practicing advocates with specialization and practice court filters.

### ⚙️ Backend Application (FastAPI)
- **Robust JWT Authentication**: Access and refresh tokens with password hashing powered by `bcrypt`.
- **Public & Role-Based Signup**: Public users, lawyers, and students can register accounts freely, while police and administrative registrations remain secured under admin-only validation.
- **Automatic Database Seeding**: Automatic creation of test roles, section mappings, sample judgments, and mock lawyer directories on first launch.
- **Sanhita Bulk API**: Endpoints for syncing the mobile app's local mapping database.
- **PDF Document Engine**: Generates professional Indian FIR-format PDF sheets dynamically using `ReportLab`.
- **Storage Adapter**: Supports uploading generated PDFs directly to Cloudflare R2 storage (falls back to local filesystem if unconfigured).


---

## 🛠️ Tech Stack

| Module | Technologies |
|---|---|
| **Mobile App (Frontend)** | Expo (React Native), TypeScript, Expo Router (file-based navigation), NativeWind (Tailwind styling), TanStack React Query, Expo SecureStore, Expo SQLite |
| **Backend API** | Python, FastAPI, SQLAlchemy (asyncio), Uvicorn, aiosqlite (SQLite) / asyncpg (PostgreSQL), Passlib (bcrypt), PyJWT/Jose (JWT), ReportLab (PDF), Boto3 (R2 Storage) |

---

## 📦 Project Structure

```text
IPC.AI_@2/
├── backend/          # FastAPI Python backend
│   ├── src/          # Source files (api, models, services, core)
│   ├── data/         # Starter dataset (IPC <-> BNS mappings)
│   └── requirements.txt
├── mobile/           # Expo React Native app
│   ├── app/          # Expo Router page tree
│   ├── components/   # UI elements and hooks
│   ├── lib/          # Utilities (API, DB, Auth)
│   └── package.json
└── README.md
```

---

## ⚙️ Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)

---

### 2. Backend Setup & Run

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment variables template and configure your secrets:
   ```bash
   copy .env.example .env
   ```
5. Run the FastAPI development server:
   ```bash
   python -m uvicorn src.main:app --host 127.0.0.1 --port 8000
   ```
   *The Swagger interactive documentation will be available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).*

---

### 3. Frontend Setup & Run

1. Navigate to the mobile directory:
   ```bash
   cd ../mobile
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Expo development server:
   - **For Mobile Emulators / Physical Devices (Expo Go)**:
     ```bash
     npx expo start
     ```
   - **For Web Browser**:
     ```bash
     npx expo start --web --clear
     ```
     *(Note: Clear cache `--clear` on the first build ensures platform-specific fallback resolution is correctly parsed).*

---

## 🔑 Default Accounts (Seeded Data)

The application automatically seeds three roles on first launch for local testing and debugging:

| Account Role | Email | Password | Purpose |
|---|---|---|---|
| **Admin** | `admin@ipc.ai` | `admin123` | Back-office management, register users |
| **Police Officer** | `officer@police.gov.in` | `officer123` | Draft and submit offline FIRs |
| **Superior Officer** | `dsp@police.gov.in` | `dsp12345` | Review, approve/reject submitted FIRs |

---

## 💡 Key Design Implementations

### Dynamic Theme Engine & Premium Dark Aesthetics
To provide a modern, visually striking user experience matching dark styles:
- **Default Dark theme**: Uses a slate-black palette (`#0F0F11` background, `#1E1E22` surfaces) accented by saffron and light blue.
- **Dynamic Context**: Configured `ThemeContext` using React state and `SecureStore`/`localStorage` to persist theme choices across sessions.
- **System-wide Integration**: All key layouts (bottom tabs, cards, status badges) read from the theme hook to automatically adjust background and border colors on toggle.

### Secure Public vs Admin Registration Flow
To support police department management while allowing lawyers and the general public to sign up:
- **Role Separation**: Added `UserRole.PUBLIC` and `UserRole.LAWYER` to the database schema.
- **Conditional Auth Validation**: Updated the backend registration endpoint with an optional security dependency. If a user registers for standard public/lawyer/student roles, no login header is required. If a user registers for police, superior officer, or administrator roles, the backend validates that the requesting client is authenticated as an administrator.

### Web Platform Support via SQLite Fallback
SQLite is not natively supported in standard web browsers. To prevent application crashes on the web:
- Native builds load [`db.ts`](file:///d:/IPC.AI_@2/mobile/lib/db.ts) (which binds to the `expo-sqlite` native module).
- Web builds dynamically load [`db.web.ts`](file:///d:/IPC.AI_@2/mobile/lib/db.web.ts) (which uses browser `localStorage` as a fallback).
- Metro utilizes platform-specific file extensions to select the correct driver at bundle-time.

### Dynamic Backend Host Resolution
To support debugging across multiple platforms without manual code changes:
- **Web Client**: Resolves backend requests to `http://localhost:8000`.
- **Android Emulator**: Resolves requests to `http://10.0.2.2:8000`.
- **Expo Go (Physical Device)**: Uses Expo Constants to dynamically parse the computer's LAN IP from the bundler URL (e.g., `http://192.168.1.X:8000`), allowing remote API testing over Wi-Fi without hardcoding.

