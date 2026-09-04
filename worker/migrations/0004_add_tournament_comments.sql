ALTER TABLE submissions ADD COLUMN tournament_name TEXT;
ALTER TABLE submissions ADD COLUMN tournament_year TEXT;

CREATE TABLE submission_comments (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE INDEX idx_submission_comments_submission_created
  ON submission_comments(submission_id, created_at ASC);
