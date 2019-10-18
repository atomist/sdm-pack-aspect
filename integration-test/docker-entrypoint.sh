#!/bin/bash

service postgresql start
cd /app

exec $*