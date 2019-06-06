
-- Fingerprints by name
select fp.name as fingerprint_name, r.name as name
  from repo_snapshots r, repo_fingerprints j, fingerprints fp
  where j.repo_snapshot_id = r.id and j.sha = fp.sha;

-- Fingerprint names
select fp.name as fingerprint_name, r.name as name
  from repo_snapshots r, repo_fingerprints j, fingerprints fp
  where j.repo_snapshot_id = r.id and j.sha = fp.sha
  group by fp.name, r.name;

-- Variance for fingerprint name
select fp.name as fingerprint_name, fp.sha as fingerprint_sha, r.name as name
  from repo_snapshots r, repo_fingerprints j, fingerprints fp
  where j.repo_snapshot_id = r.id and j.sha = fp.sha
    and fp.name = 'f2'
  group by fp.name, r.name, fp.sha
  order by fp.sha;

select fp.name as fingerprint_name, fp.sha as fingerprint_sha, string_agg(r.name, ',') as names
  from repo_snapshots r, repo_fingerprints j, fingerprints fp
  where j.repo_snapshot_id = r.id and j.sha = fp.sha
    and fp.name = 'f2'
  group by fp.sha
  order by fp.sha;

select fp.name as fingerprint_name, fp.sha as fingerprint_sha, r.name as name
  from fingerprints fp, repo_fingerprints as j, repo_snapshots as r
  where j.sha = fp.sha and r.id = j.repo_snapshot_id
    and fp.name = 'f2'
    group by fp.sha, r.name;


SELECT json_agg(fingerprints) FROM fingerprints


SELECT row_to_json(fingerprint_groups) FROM (SELECT json_agg(fp) children
FROM (
       SELECT
         fingerprints.name, fingerprints.sha, fingerprints.data,
         (
           SELECT json_agg(row_to_json(repo))
           FROM (
                  SELECT
                    repo_snapshots.owner, repo_snapshots.name, repo_snapshots.url, 1 as size
                  FROM repo_fingerprints, repo_snapshots
                  WHERE repo_fingerprints.sha = fingerprints.sha AND repo_snapshots.id = repo_fingerprints.repo_snapshot_id
                ) repo
         ) children
       FROM fingerprints WHERE fingerprints.name = 'tsVersion'
) fp) as fingerprint_groups;


select row_to_json(fs) FROM (
  SELECT * from fingerprints
) as fs;

select distinct name from fingerprints order by name;

select name, count(*)
  from fingerprints
  group by name;



SELECT row_to_json(fingerprint_groups) FROM (SELECT json_agg(fp) children
FROM (
       SELECT
         fingerprints.name, fingerprints.sha, fingerprints.data,
         (
           SELECT json_agg(row_to_json(repo))
           FROM (
                  SELECT
                    repo_snapshots.owner, repo_snapshots.name, repo_snapshots.url, 1 as size
                  FROM repo_fingerprints, repo_snapshots
                  WHERE repo_fingerprints.sha = fingerprints.sha AND repo_snapshots.id = repo_fingerprints.repo_snapshot_id
                ) repo
         ) children
       FROM fingerprints WHERE fingerprints.name = 'tsVersion'
) fp) as fingerprint_groups;