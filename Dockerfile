FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@11.11.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
RUN pnpm db:generate
COPY lib ./lib
COPY services ./services
COPY scripts/video-worker.ts ./scripts/video-worker.ts
USER node
CMD ["sh", "-c", "pnpm db:deploy && exec pnpm video:worker"]
