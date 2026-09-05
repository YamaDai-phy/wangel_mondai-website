CREATE TABLE submissions_new (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  title TEXT NOT NULL,
  uploader TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('question', 'answer', 'mix', 'past_exam', 'incomplete')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'hidden', 'rejected', 'incomplete')),
  review_token_hash TEXT,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  tournament_name TEXT,
  tournament_year TEXT,
  file_kind TEXT
);

INSERT INTO submissions_new
SELECT id, r2_key, filename, title, uploader, subject, category, doc_type, status,
       review_token_hash, size, created_at, reviewed_at, tournament_name, tournament_year, file_kind
  FROM submissions;

DROP TABLE submissions;
ALTER TABLE submissions_new RENAME TO submissions;
CREATE INDEX idx_submissions_status_created ON submissions(status, created_at DESC);
