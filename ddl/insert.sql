INSERT INTO repo_snapshots (workspace_id, provider_id, owner, name, url, commit_sha, timestamp, analysis)
VALUES (
      'local',
      'X1',
      'owner',
        'repo',
        '123',
        'http',
        now(),
        '{ "stuff": "things" }'
        );

INSERT INTO fingerprints (name, feature_name, sha)
values (
  'f1',
  'killer-app',
  '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12'
);

INSERT INTO fingerprints (name, feature_name, sha)
values (
  'f2',
  'killer-app',
  '2fd4e1c67a2d28fced849ee1bb76e7391c93eb12'
);

-- Variant of f2
INSERT INTO fingerprints (name, feature_name, sha, data)
values (
  'f2',
  'killer-app',
  '3fd4e1c67a2d28fced849ee1bb76e7391c93eb12',
  '{ "thing1": "one", "thing2": "two" }'
);

INSERT INTO repo_fingerprints (repo_snapshot_id, sha)
values (
  lastVal(),
  '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12'
);

INSERT INTO repo_fingerprints (repo_snapshot_id, sha)
values (
  lastVal(),
  '2fd4e1c67a2d28fced849ee1bb76e7391c93eb12'
);

INSERT INTO repo_snapshots (workspace_id, provider_id, owner, name, url, commit_sha, timestamp, analysis)
VALUES (
      'local',
      'X2',
      'owner',
        'repo2',
        '123',
        'http',
        now(),
        '{ "stuff": "things" }'
        );

// Has a variant of f2
INSERT INTO repo_fingerprints (repo_snapshot_id, sha)
values (
  lastVal(),
  '3fd4e1c67a2d28fced849ee1bb76e7391c93eb12'
);

INSERT INTO repo_snapshots (workspace_id, provider_id, owner, name, url, commit_sha, timestamp, analysis)
VALUES (
      'local',
      'X2',
      'owner',
        'repo3',
        '123',
        'http',
        now(),
        '{ "stuff": "things" }'
        );


INSERT INTO repo_fingerprints (repo_snapshot_id, sha)
values (
  lastVal(),
  '2fd4e1c67a2d28fced849ee1bb76e7391c93eb12'
);
