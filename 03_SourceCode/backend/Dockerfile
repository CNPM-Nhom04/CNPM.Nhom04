FROM node:24.21.0-bookworm-slim AS development
WORKDIR /app/03_SourceCode/backend
COPY 03_SourceCode/backend/package*.json ./
RUN npm ci
COPY 03_SourceCode/backend/ ./
EXPOSE 3002
CMD ["npm", "run", "start:dev"]

FROM development AS build
RUN npm run build

FROM node:24.21.0-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app/03_SourceCode/backend
COPY 03_SourceCode/backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/03_SourceCode/backend/dist ./dist
COPY 03_SourceCode/backend/scripts/database ./scripts/database
COPY 03_SourceCode/backend/src/core/database/ctdt.sql ./src/core/database/ctdt.sql
RUN mkdir -p storage/program-reviews && chown -R node:node /app
USER node
EXPOSE 3002
CMD ["node", "dist/main.js"]
