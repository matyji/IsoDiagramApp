# Build Stage
FROM node:20-slim AS build

WORKDIR /app

# Install Puppeteer dependencies (Chrome/Chromium runtime)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Copy source code
COPY . .

# Install (workspaces) + build
RUN npm install
RUN npm run build:lib
RUN npm run install --workspaces --include-workspace-root
RUN npm run build:web
RUN npm run build:mcp

# Netoyagge : enlever les dev dependencies (image plus légère)
ENV NODE_ENV=production
RUN npm prune --omit=dev

# Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# App env
ENV BACKEND_PORT=3001
ENV ENABLE_SERVER_STORAGE=true
ENV STORAGE_PATH=/app/apps/api/data/diagrams
ENV DOWNLOAD_ASSETS_PATH=/app/apps/api/data/assets/imported
ENV WEB_APP_URL=http://localhost:3001

# Expose the combined port
EXPOSE 3001

# Create storage volume directory
RUN mkdir -p /app/apps/api/data/diagrams /app/apps/api/data/assets/imported /app/apps/api/data/assets/base

# Define the volume for persistent data
VOLUME ["/app/apps/api/data/diagrams", "/app/apps/api/data/assets/imported", "/app/apps/api/data/assets/base"]

# Start the combined server (API + Static Web)
CMD ["node", "apps/api/server.js"]
