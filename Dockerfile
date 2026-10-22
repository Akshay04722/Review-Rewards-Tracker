FROM node:20-alpine AS base

# Install dependencies required for Alpine and Playwright/Prisma if needed
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Copy source files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

EXPOSE 3000

# Default command runs the web app
CMD ["npm", "start"]
