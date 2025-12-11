# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Install tools needed at runtime (pg_dump for backups, certs, timezone data, fonts for sharp)
RUN apk add --no-cache postgresql-client ca-certificates tzdata fontconfig ttf-dejavu \
  && update-ca-certificates
# Install only production deps
COPY package*.json ./
RUN npm install --omit=dev
# Copy built dist
COPY --from=builder /app/dist ./dist
# Copy public directory (needed by ServeStaticModule)
COPY --from=builder /app/public ./public
# Ensure backup directory exists (adjust if using a bind mount)
RUN mkdir -p /data/storage/backups
EXPOSE 3000
CMD ["node", "dist/src/main.js"]