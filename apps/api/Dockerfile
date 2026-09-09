FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/cache/package.json ./packages/cache/
COPY packages/db/package.json ./packages/db/
COPY packages/evidence/package.json ./packages/evidence/
COPY packages/shared/package.json ./packages/shared/
RUN npm install --omit=dev

FROM base AS build
COPY . .
RUN npm install && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages ./packages
EXPOSE 5000
CMD ["node", "apps/api/dist/server.js"]
