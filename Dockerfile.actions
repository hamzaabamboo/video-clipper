FROM node:alpine

WORKDIR /app

RUN apk update && apk --no-cache add --virtual native-deps g++ gcc libgcc libstdc++ linux-headers make python libpcap-dev

RUN npm install -g @nestjs/cli

COPY ./server/package.json ./server/yarn.lock ./

RUN npm install

COPY ./server .

RUN npm run build

COPY ./client-build ./client

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

ARG PORT=3000
EXPOSE ${PORT}

CMD ["npm", "start"]