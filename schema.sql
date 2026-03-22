-- ============================================================
-- Luxion Solutions CRM — PostgreSQL Schema (Neon)
-- Run once in Neon SQL Editor
-- ============================================================

-- LEADS (pipeline management)
CREATE TABLE IF NOT EXISTS leads (
  id          SERIAL PRIMARY KEY,
  org         TEXT NOT NULL,
  contact     TEXT,
  phone       TEXT,
  email       TEXT,
  svc         TEXT,
  val         BIGINT DEFAULT 0,
  stage       TEXT NOT NULL DEFAULT 'Lead'
                CHECK (stage IN ('Lead','Demo Scheduled','Demo Done','Proposal Sent','Negotiating','Won','Lost')),
  src         TEXT,
  demo        TEXT DEFAULT 'No',
  prop        TEXT DEFAULT 'No',
  act         TEXT,
  follow_date DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- PAYMENTS (client payment records)
CREATE TABLE IF NOT EXISTS payments (
  id          SERIAL PRIMARY KEY,
  client      TEXT NOT NULL,
  svc         TEXT,
  total       BIGINT DEFAULT 0,
  deposit     BIGINT DEFAULT 0,
  bal_paid    BIGINT DEFAULT 0,
  dep_date    DATE,
  bal_date    DATE,
  method      TEXT DEFAULT 'MTN Mobile Money',
  start_date  DATE,
  end_date    DATE,
  next_due    DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- EXPENSES (company operational costs)
CREATE TABLE IF NOT EXISTS expenses (
  id          SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  amount      BIGINT NOT NULL DEFAULT 0,
  expense_date DATE,
  category    TEXT,
  method      TEXT DEFAULT 'MTN Mobile Money',
  project     TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_leads_stage   ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(bal_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
