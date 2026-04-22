# CTAM Project Structure

## 📁 Directory Layout

```
Capstone-main/                          # Project Root
│
├── 📄 README.md                         # Main project readme
├── 📄 package.json                      # Node.js dependencies
├── 📄 package-lock.json                 # Dependency lock file
├── 📄 tsconfig.json                     # TypeScript configuration
├── 📄 vite.config.ts                    # Vite build configuration
├── 📄 tailwind.config.ts                # TailwindCSS configuration
├── 📄 components.json                   # shadcn/ui components config
├── 📄 drizzle.config.ts                 # Database configuration
├── 📄 ml_model.py                       # Python ML model (XGBoost + RF)
├── 📄 requirements.txt                  # Python dependencies
├── 📄 .env.example                      # Example environment variables
├── 📄 .gitignore                        # Git ignore rules
│
├── 📁 client/                           # Frontend (React)
│   ├── src/
│   │   ├── pages/                       # Route pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Vulnerabilities.tsx
│   │   │   ├── Analyze.tsx
│   │   │   ├── Model.tsx
│   │   │   ├── Alerts.tsx
│   │   │   └── AuditLogs.tsx
│   │   │
│   │   ├── components/                  # Reusable components
│   │   │   ├── ui/                      # shadcn/ui components
│   │   │   ├── SafeHtml.tsx             # XSS prevention
│   │   │   ├── RiskBadge.tsx
│   │   │   └── StatsCard.tsx
│   │   │
│   │   ├── hooks/                       # Custom React hooks
│   │   │   ├── use-auth.ts
│   │   │   ├── use-mutation-toast.ts
│   │   │   ├── use-filtered-data.ts
│   │   │   ├── use-formatting.ts
│   │   │   └── use-toast.ts
│   │   │
│   │   ├── lib/                         # Utilities & helpers
│   │   │   ├── queryClient.ts           # TanStack Query setup
│   │   │   ├── api-types.ts             # Type-safe API error handling
│   │   │   ├── auth.ts                  # Auth utilities
│   │   │   └── utils.ts                 # General utilities
│   │   │
│   │   ├── App.tsx                      # Root component
│   │   ├── main.tsx                     # Entry point
│   │   └── index.css                    # Global styles
│   │
│   └── index.html                       # HTML template
│
├── 📁 server/                           # Backend (Express)
│   ├── index.ts                         # Server entry point
│   ├── routes.ts                        # API endpoints (21 total)
│   ├── auth.ts                          # Authentication & RBAC
│   ├── storage.ts                       # File-based persistence
│   ├── static.ts                        # Static file serving
│   ├── vite.ts                          # Vite dev server setup
│   │
│   └── lib/                             # Backend utilities
│       ├── cisaFeed.ts                  # CISA vulnerability fetcher
│       ├── mlModel.ts                   # ML model wrapper
│       ├── mlWrapper.ts                 # Python subprocess bridge
│       ├── openai.ts                    # OpenAI integration
│       ├── email.ts                     # Email sending
│       └── tfidf.ts                     # TF-IDF utilities
│
├── 📁 shared/                           # Shared code
│   └── schema.ts                        # TypeScript types & Zod schemas
│
├── 📁 public/                           # Static assets
│   └── (favicon, etc.)
│
├── 📁 data/                             # Persistent JSON storage
│   ├── vulnerabilities.json             # CVE data (from CISA)
│   ├── predictions.json                 # ML predictions
│   ├── alerts.json                      # Alert tracking
│   ├── auditLogs.json                   # Activity logs
│   ├── mitigations.json                 # Remediation plans
│   ├── modelMetrics.json                # Model accuracy/metrics
│   ├── users.json                       # User accounts (auto-created)
│   ├── state.json                       # Last data collection/training
│   │
│   └── models/                          # ML model artifacts (after training)
│       ├── xgb_model.json               # XGBoost weights
│       ├── rf_model.pkl                 # Random Forest weights
│       ├── scaler.pkl                   # Feature scaler
│       └── tfidf_vectorizer.pkl         # TF-IDF vocabulary
│
├── 📁 script/                           # Build & utility scripts
│   └── build.ts                         # Production build script
│
├── 📁 docs/                             # Documentation
│   ├── README.md                        # This file
│   ├── COMPLETE_PROJECT_GUIDE.md        # Comprehensive guide (80+ pages)
│   ├── QUICK_REFERENCE.md               # Quick reference cheat sheet
│   ├── STATUS_REPORT.md                 # Production readiness report
│   ├── CRITICAL_FIXES_APPLIED.md        # Security fixes documentation
│   └── PROJECT_STRUCTURE.md             # This file
│
└── 📁 node_modules/                     # Node.js dependencies (generated)
    └── (auto-generated, not in version control)
```

---

## 📋 File Descriptions

### Root Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | npm dependencies & scripts |
| `tsconfig.json` | TypeScript compiler options |
| `vite.config.ts` | Vite bundler configuration |
| `tailwind.config.ts` | TailwindCSS styling |
| `components.json` | shadcn/ui component registry |
| `drizzle.config.ts` | Database migrations (optional) |

### Core Application Files

| File | Purpose |
|------|---------|
| `ml_model.py` | Python ML ensemble model |
| `requirements.txt` | Python dependencies |
| `.env.example` | Template for environment variables |
| `.gitignore` | Files to exclude from git |

### Source Code Folders

| Folder | Purpose |
|--------|---------|
| `client/` | React frontend application |
| `server/` | Express.js backend API |
| `shared/` | Shared types & schemas |
| `public/` | Static assets (fonts, images) |
| `script/` | Build & utility scripts |

### Data & Storage

| Folder | Purpose |
|--------|---------|
| `data/` | Persistent JSON files (vulnerabilities, predictions, alerts) |
| `data/models/` | Trained ML model artifacts (created after training) |

### Documentation

| Folder | Purpose |
|--------|---------|
| `docs/` | Project documentation |

---

## 🚀 Quick Navigation

**Getting Started:**
- Start here: `docs/QUICK_REFERENCE.md`
- Full guide: `docs/COMPLETE_PROJECT_GUIDE.md`

**Production:**
- Check: `docs/STATUS_REPORT.md`
- Security fixes: `docs/CRITICAL_FIXES_APPLIED.md`

**Running the Project:**
1. Read: `README.md`
2. Run: `npm run dev`
3. Open: `http://localhost:5000`

---

## 📊 File Statistics

```
Frontend (React):       ~2,500 lines
Backend (Express):      ~2,000 lines
ML Model (Python):      ~520 lines
Shared Types:           ~500 lines
Documentation:          ~300 lines
────────────────────────────────
Total Source Code:      ~5,500 lines
```

---

## 🔒 Important Files

**Never commit:**
- `.env` (contains secrets)
- `node_modules/` (auto-generated)
- `dist/` (build output)
- `data/*.json` (contains production data)

**Always backup:**
- `data/` (production data)
- `.env` (custom environment variables)

---

## 📦 Dependencies

### Frontend
- React 18
- TypeScript
- TailwindCSS
- TanStack Query
- Zod
- Wouter

### Backend
- Express.js
- bcrypt
- Zod

### ML
- Python 3.8+
- XGBoost
- scikit-learn
- NumPy

---

**Last Updated:** April 22, 2026  
**Status:** Production Ready ✅
