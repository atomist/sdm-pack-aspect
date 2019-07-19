## create the database if needed (in psql):

# DROP DATABASE org_viz;
# CREATE DATABASE org_viz;

## Connect to that database (in psql)
# \connect org_viz

## Run this DDL in either psql or pgadmin:

DROP TABLE IF EXISTS repo_fingerprints;

DROP TYPE IF EXISTS SEVERITY;

DROP TABLE IF EXISTS fingerprints;

DROP TABLE IF EXISTS repo_snapshots;

DROP TABLE IF EXISTS branch_heads;

DROP TABLE IF EXISTS fingerprint_analytics;

DROP TABLE IF EXISTS ideal_fingerprints;

CREATE TABLE repo_snapshots (
 id varchar NOT NULL PRIMARY KEY,
 workspace_id varchar NOT NULL,
 provider_id text NOT NULL,
 owner text NOT NULL,
 name text NOT NULL,
 url text NOT NULL,
 branch text,
 path text,
 commit_sha varchar NOT NULL,
 analysis jsonb,
 timestamp TIMESTAMP  NOT NULL,
 query text
);

-- Kept up to date on a trigger on repo_snapshots
CREATE TABLE branch_heads (
 repo_snapshot_id varchar references repo_snapshots(id),
 workspace_id varchar NOT NULL,
 url text NOT NULL,
 branch text NOT NULL,
 commit_sha varchar NOT NULL,
 timestamp TIMESTAMP  NOT NULL,
 PRIMARY KEY (workspace_id, url, branch)
);

-- This view will show only the current repo snapshot.
-- Query it instead of repo_snapshots
CREATE OR REPLACE VIEW current_repo_snapshots AS
  SELECT rs.id, rs.workspace_id, rs.provider_id, rs.owner, rs.name, rs.url, rs.branch, rs.path, rs.commit_sha, rs.analysis, rs.timestamp, rs.query
  FROM repo_snapshots rs, branch_heads bh
  WHERE bh.repo_snapshot_id = rs.id;

CREATE OR REPLACE FUNCTION update_branch_heads_for_snapshot() RETURNS trigger AS $$
BEGIN
   INSERT into branch_heads (workspace_id, repo_snapshot_id, url, branch, commit_sha, timestamp)
   VALUES (NEW.workspace_id, NEW.id, NEW.url,
   CASE WHEN NEW.branch IS NULL THEN 'master' ELSE NEW.branch END,
   NEW.commit_sha, NEW.timestamp)
   ON CONFLICT ON CONSTRAINT branch_heads_pkey DO UPDATE SET commit_sha = NEW.commit_sha, timestamp = NEW.timestamp;
   RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

DROP TRIGGER IF EXISTS update_repo_heads on repo_snapshots;
CREATE TRIGGER update_repo_heads
    AFTER INSERT OR UPDATE ON repo_snapshots
    FOR EACH ROW
    EXECUTE PROCEDURE update_branch_heads_for_snapshot();

-- One instance for each fingerprint
CREATE TABLE fingerprints (
  name text NOT NULL,
  feature_name text NOT NULL,
  sha varchar NOT NULL,
  data jsonb,
  id varchar NOT NULL PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS repo_fingerprints (
  repo_snapshot_id varchar references repo_snapshots(id),
  fingerprint_id varchar references fingerprints(id),
  PRIMARY KEY (repo_snapshot_id, fingerprint_id)
);

-- This table must be kept up to date by application code
-- whenever a fingerprint is inserted
CREATE TABLE fingerprint_analytics (
  name text NOT NULL,
  feature_name text NOT NULL,
  workspace_id varchar NOT NULL,
  count numeric,
  entropy numeric,
  variants numeric,
  PRIMARY KEY (name, feature_name, workspace_id)
);

-- For each name/feature_name combination, the ideal for the given workspace
CREATE TABLE ideal_fingerprints (
  name text NOT NULL,
  feature_name text NOT NULL,
  -- Workspace this ideal applies to
  workspace_id varchar NOT NULL,
  sha varchar NOT NULL,
  data jsonb,
  id varchar NOT NULL PRIMARY KEY
);

CREATE INDEX ON repo_snapshots (workspace_id);

CREATE INDEX ON fingerprints (name);
CREATE INDEX ON fingerprints (feature_name);

CREATE INDEX ON fingerprint_analytics (workspace_id);

CREATE INDEX on branch_heads(url);

CREATE INDEX on branch_heads(commit_sha);