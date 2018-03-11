FROM node:8.4.0-alpine

RUN apk add --no-cache git

RUN npm install -g pm2
RUN pm2 update

RUN mkdir -p /usr/src/app
COPY ./src /usr/src/app
WORKDIR /usr/src/app

RUN npm install

EXPOSE 3000

CMD ["pm2-docker", "server.js"]
