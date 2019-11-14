FROM node:10

RUN apt update && apt install -y postgresql

USER postgres

RUN service postgresql start &&\
    psql --command "CREATE USER root WITH SUPERUSER PASSWORD 'sebastian';" && createdb root root

ENV PGUSER root
ENV PGPASSWORD sebastian

USER root

# copied from https://success.docker.com/article/use-a-script-to-initialize-stateful-container-data
COPY docker-entrypoint.sh /usr/local/bin/
RUN ln -s /usr/local/bin/docker-entrypoint.sh / 

ENTRYPOINT [ "docker-entrypoint.sh" ]

# docker build -t node-and-pg integration-test
# docker run --rm --mount source=$(pwd),target=/app,type=bind -u postgres -it node-and-pg /bin/bash
# > service postgresql start
# > cd /app
# > npm run integration-test

CMD [ "npm", "run", "integration-test" ]
