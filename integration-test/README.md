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

`docker run --rm --name integration-test --mount source=$(pwd),target=/app,type=bind -it node-and-pg /bin/bash`

Inside that shell, run the tests (repeat if necessary):
 
`npm run integration-test`

The first time, the db:delete command will fail because the database didn't exist. This is fine.

Here's a handy command to look around in the database in the container, while it's running:

`docker exec -it integration-test psql -d org_viz`