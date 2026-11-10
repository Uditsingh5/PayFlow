FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production=false

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# --- Production Image ---
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/migrations ./dist/db/migrations

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/server.js"]

