FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache docker-cli
COPY package*.json ./
RUN npm install

FROM node:20-alpine AS development
WORKDIR /app
ENV NODE_ENV=development
COPY --from=base /app/node_modules ./node_modules
COPY . .
RUN mkdir -p logs uploads
EXPOSE 5000
CMD ["npm", "run", "dev"]

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY . .
RUN mkdir -p logs uploads
EXPOSE 5000
CMD ["node", "server.js"]
