
FROM node:22-bookworm-slim

WORKDIR /app

# Native build dependencies for better-sqlite3.
RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package configuration.
COPY package*.json ./

# Install production dependencies.
RUN npm install --omit=dev

# Copy application source.
COPY src ./src
COPY public ./public

# Create persistent data directory.
RUN mkdir -p /app/data

# Run as an unprivileged user.
RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DB_PATH=/app/data/sombra.sqlite

EXPOSE 3000

CMD ["node", "src/server.js"]
