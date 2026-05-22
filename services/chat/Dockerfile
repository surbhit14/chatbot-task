FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json tsconfig.base.json ./
COPY sdk/package.json ./sdk/package.json
COPY services/chat/package.json ./services/chat/package.json

# Install all workspace deps from root (resolves @ollive/sdk as local package)
RUN npm install

# Copy source
COPY sdk/ ./sdk/
COPY services/chat/src ./services/chat/src
COPY services/chat/tsconfig.json ./services/chat/tsconfig.json

# Build SDK first, then chat service
RUN cd sdk && npx tsc -p tsconfig.json
RUN cd services/chat && npx tsc -p tsconfig.json

FROM node:20-alpine
WORKDIR /app

# Copy node_modules (includes @ollive/sdk symlink -> ../../sdk)
COPY --from=builder /app/node_modules ./node_modules
# Copy sdk so the symlink resolves at runtime
COPY --from=builder /app/sdk/dist ./sdk/dist
COPY --from=builder /app/sdk/package.json ./sdk/package.json
# Copy chat service dist
COPY --from=builder /app/services/chat/dist ./services/chat/dist

WORKDIR /app/services/chat
EXPOSE 3000
CMD ["node", "dist/index.js"]
