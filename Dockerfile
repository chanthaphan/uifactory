# UIFactory backend (NestJS) — build from the repo root: docker build -f Dockerfile -t uifactory-api .
# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/
RUN npm ci
COPY . .
# Generate the Prisma client BEFORE building: nest build typechecks against the generated client.
RUN npx prisma generate --schema backend/prisma/schema.prisma \
 && npm run build --workspace backend

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3001
# Workspace deps are hoisted to the root node_modules (includes the Prisma client + CLI).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/backend/package*.json ./backend/
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/scripts ./backend/scripts
USER node
EXPOSE 3001
CMD ["node", "backend/dist/main.js"]
