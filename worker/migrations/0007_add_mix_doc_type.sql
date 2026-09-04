CREATE TABLE submissions_new (
  id TEXT PRIMARY KEY, r2_key TEXT NOT NULL UNIQUE, filename TEXT NOT NULL, title TEXT NOT NULL,
  uploader TEXT NOT NULL, subject TEXT NOT NULL, category TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('question', 'answer', 'mix', 'past_exam', 'incomplete')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected', 'incomplete')),
  review_token_hash TEXT, size INTEGER NOT NULL, created_at TEXT NOT NULL, reviewed_at TEXT,
  tournament_name TEXT, tournament_year TEXT, file_kind TEXT
);
INSERT INTO submissions_new SELECT id,r2_key,filename,title,uploader,subject,category,doc_type,status,review_token_hash,size,created_at,reviewed_at,tournament_name,tournament_year,file_kind FROM submissions;
CREATE TABLE submission_comments_new (
  id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES submissions_new(id) ON DELETE CASCADE
);
INSERT INTO submission_comments_new SELECT id,submission_id,author,body,created_at FROM submission_comments;
DROP TABLE submission_comments;
DROP TABLE submissions;
ALTER TABLE submissions_new RENAME TO submissions;
ALTER TABLE submission_comments_new RENAME TO submission_comments;
CREATE INDEX idx_submissions_status_created ON submissions(status, created_at DESC);
CREATE INDEX idx_submission_comments_submission_created ON submission_comments(submission_id, created_at ASC);
