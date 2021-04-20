FROM node:alpine as builder
WORKDIR /app
COPY ./client/package.json ./client/yarn.lock ./client/
COPY ./server ./server/
RUN cd ./client && npm install
COPY ./client/ ./client/
RUN cd ./client && npm run build

FROM node As server

WORKDIR /app

RUN npm install -g @nestjs/cli

RUN apt update 

RUN apt install libpcap-dev -y

COPY ./server/package.json ./server/yarn.lock ./

RUN npm install

COPY ./server .

RUN npm run build

COPY --from=builder /app/client/build /app/client

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

ARG PORT=3000
EXPOSE ${PORT}

CMD ["npm", "start"]