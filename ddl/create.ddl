DROP DATABASE org_viz;
CREATE DATABASE org_viz;
\connect org_viz

DROP TABLE IF EXISTS repo_fingerprints;

DROP TABLE IF EXISTS fingerprints;

DROP TABLE IF EXISTS repo_snapshots;

CREATE TABLE repo_snapshots (
 id serial NOT NULL PRIMARY KEY,
 workspace_id varchar NOT NULL,
 provider_id text NOT NULL,
 owner text NOT NULL,
 name text NOT NULL,
 url text NOT NULL,
 branch text,
 path text,
 commit_sha varchar NOT NULL,
 analysis json,
 timestamp TIMESTAMP  NOT NULL
);

-- One instance for each fingerprint
CREATE TABLE fingerprints (
  name text NOT NULL,
  feature_name text,
  sha varchar NOT NULL PRIMARY KEY,
  data json
);

-- Join table
CREATE TABLE repo_fingerprints (
  repo_snapshot_id int references repo_snapshots(id),
  sha varchar references fingerprints(sha),
  PRIMARY KEY (repo_snapshot_id, sha)
);
