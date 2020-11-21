FROM node:12-alpine

ENV DATA_DIR=/data

RUN apk add build-base python-dev

WORKDIR /app

ADD package*json ./
RUN npm install

ADD * ./
RUN npm build

CMD node dist/index.js