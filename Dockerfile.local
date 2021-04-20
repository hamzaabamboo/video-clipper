FROM node:alpine as builder
WORKDIR /app
COPY ./client/package.json ./client/yarn.lock ./
RUN yarn
COPY ./client .
RUN yarn build

FROM node:alpine As server

WORKDIR /app

RUN yarn global add @nestjs/cli

RUN apk add  --no-cache ffmpeg

COPY ./server/package.json ./server/yarn.lock ./

RUN yarn

COPY ./server .

RUN yarn build

COPY --from=builder /app/build /app/client

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

ARG PORT=3000
EXPOSE ${PORT}

CMD ["npm", "start"]