# Just use the official Playwright image instead of extracting the pieces to run
# Playwright in Docker ourselves. It ties us to their choice of Ubuntu+Node
# versions, but I don't expect that to be a very big deal.
FROM mcr.microsoft.com/playwright:focal

ENV DATA_DIR=/data

# For compiling better-sqlite3
RUN apt update && apt install -y build-essential python-dev

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
CMD npm run start