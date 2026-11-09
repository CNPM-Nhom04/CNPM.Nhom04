FROM node:24.21.0-bookworm-slim AS development
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/03_SourceCode/frontend
COPY 03_SourceCode/frontend/package*.json ./
RUN npm ci
COPY 03_SourceCode/frontend/ ./
# A database connection is not needed to generate the client.
RUN DATABASE_URL=mysql://build:build@127.0.0.1:3306/build npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

FROM development AS build
ENV NEXT_TELEMETRY_DISABLED=1
RUN DATABASE_URL=mysql://build:build@127.0.0.1:3306/build npm run build

FROM node:24.21.0-bookworm-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app/03_SourceCode/frontend
COPY --from=build --chown=node:node /app/03_SourceCode/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/03_SourceCode/frontend/.next/static ./.next/static
COPY --from=build --chown=node:node /app/03_SourceCode/frontend/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
