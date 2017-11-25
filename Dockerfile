FROM node:8.4.0-alpine

RUN apk add --no-cache git

RUN mkdir -p /usr/src/app
COPY ./src /usr/src/app
WORKDIR /usr/src/app

RUN npm install

#EXPOSE 3000

CMD ["npm", "start"]
