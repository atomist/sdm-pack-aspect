FROM postgres:10

RUN apt-get update || echo "WTF-ever"
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get install -y nodejs npm