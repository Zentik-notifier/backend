# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
# Copy built dist
COPY --from=builder /app/dist ./dist
# Copy any runtime files (e.g., swagger ui assets if needed)
EXPOSE 3000
CMD ["node", "dist/main.js"]