# Just use the official Playwright image instead of extracting the pieces to run
# Playwright in Docker ourselves. It ties us to their choice of Ubuntu+Node
# versions, but I don't expect that to be a very big deal.
FROM mcr.microsoft.com/playwright:focal

ENV DATA_DIR=/data

# For compiling better-sqlite3
RUN apt update && apt install -y build-essential python-dev

WORKDIR /app

ADD package*json ./
RUN npm install

ADD . ./
RUN npm run build

RUN mkdir -p /data
CMD node dist/index.js