# Luxion Solutions CRM
## Deploy in 3 Steps

### Step 1 — Neon Database
1. Go to neon.tech → create project named `luxion-crm`
2. Open SQL Editor → paste `schema.sql` → Run
3. Copy your connection string

### Step 2 — GitHub + Netlify
1. Push this folder to a new GitHub repo
2. Connect to Netlify → Import from GitHub
3. Build settings auto-detected from netlify.toml

### Step 3 — Environment Variable
Netlify → Project configuration → Environment variables → Add:
- Key: `DATABASE_URL`
- Value: your Neon connection string

Trigger redeploy. Done! ✅

## API Endpoints
- `/.netlify/functions/leads`    — Leads CRUD
- `/.netlify/functions/payments` — Payments CRUD
- `/.netlify/functions/expenses` — Expenses CRUD
- `/.netlify/functions/summary`  — Dashboard KPIs
