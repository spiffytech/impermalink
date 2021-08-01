# Just use the official Playwright image instead of extracting the pieces to run
# Playwright in Docker ourselves. It ties us to their choice of Ubuntu+Node
# versions, but I don't expect that to be a very big deal.
FROM mcr.microsoft.com/playwright:focal

RUN apt update && apt install -y wget

RUN wget https://github.com/benbjohnson/litestream/releases/download/v0.3.5/litestream-v0.3.5-linux-amd64.deb
RUN dpkg -i litestream-v0.3.5-linux-amd64.deb

ENV DATA_DIR=/data

# build-essential and python-dev are for compiling better-sqlite3.
# imagemagick is for converting favicons into a file format ColorThief can parse.
RUN apt update && apt install -y build-essential python-dev imagemagick

WORKDIR /app

ADD sapper/package*json ./
RUN npm install

ENV NODE_ENV=production

ADD ./sapper ./
ADD ./CHECKS ./
# Do before `run build` so our generate file gets copied to our Sapper build
# output. Also have to build tailwind after copying in Sapper or PurgeCSS
# doesn't work.
RUN npm run tailwind
RUN npm run cachebust
RUN npm run build

RUN mkdir -p /data
CMD ["sh", "-c", "litestream replicate -exec 'npm start' || npm start"]
