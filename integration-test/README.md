# Integration tests for sdm-pack-aspect

These test Postgres database setup and use.

To run only these tests, from the repository root: `npm run test:integration`

To DELETE YOUR DATABASE, re-create it, and run these tests: `npm run integration-test`

## Run them in Docker

A much better idea is to run these in Docker.

Here is a way to do this.
From the root of this repository (not this directory), build a container:

`docker build -t node-and-pg integration-test`

Then run it, mounting this repo's files, and get a shell:

`docker run --rm --mount source=$(pwd),target=/app,type=bind -u postgres -it node-and-pg /bin/bash`

Inside that shell, do this once:

```
service postgresql start
cd /app
```

Then run the tests (repeat if necessary):
 
`npm run integration-test`
