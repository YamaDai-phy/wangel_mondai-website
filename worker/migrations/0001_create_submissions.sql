CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  title TEXT NOT NULL,
  uploader TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('question', 'answer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  review_token_hash TEXT,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_submissions_status_created
  ON submissions(status, created_at DESC);
