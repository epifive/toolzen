# syntax=docker/dockerfile:1
# Toolzen production image.
#   docker build -t toolzen .
#   docker run -p 3000:3000 -v toolzen-storage:/app/storage toolzen

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN addgroup -S toolzen && adduser -S toolzen -G toolzen
COPY --from=build --chown=toolzen:toolzen /app/.next ./.next
COPY --from=build --chown=toolzen:toolzen /app/node_modules ./node_modules
COPY --from=build --chown=toolzen:toolzen /app/public ./public
COPY --from=build --chown=toolzen:toolzen /app/package.json /app/server.js /app/next.config.ts ./
RUN mkdir -p storage && chown toolzen:toolzen storage
USER toolzen
VOLUME ["/app/storage"]
EXPOSE 3000
CMD ["node", "server.js"]
