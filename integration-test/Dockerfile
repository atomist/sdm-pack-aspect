FROM node:10

RUN apt-get update
RUN apt-get install -y postgresql

USER postgres

RUN service postgresql start &&\
    psql --command "CREATE USER root WITH SUPERUSER PASSWORD 'sebastian';" && createdb root root

ENV PGUSER root
ENV PGPASSWORD sebastian

USER root

# docker build -t node-and-pg integration-test
# docker run --rm --mount source=$(pwd),target=/app,type=bind -u postgres -it node-and-pg /bin/bash
# > service postgresql start
# > cd /app
# > npm run integration-test
