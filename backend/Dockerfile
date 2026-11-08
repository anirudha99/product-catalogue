# syntax=docker/dockerfile:1

# Optional: networks that inspect HTTPS (corporate proxies) need their root certificate
# trusted during `npm ci` and at runtime. Pass a PEM bundle as the build secret `extra_ca`
# (see docker-compose.override.example.yml). Without it, nothing changes.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=extra_ca \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --no-fund --no-audit

FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# `docker compose --profile test run --rm api-test` runs the tests with no local Node needed.
FROM deps AS test
COPY . .
# API tests compare responses with the contract fixtures in <repo>/contract (named build context).
COPY --from=contract . /contract
CMD ["npm", "test"]

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=extra_ca \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --omit=dev --no-fund --no-audit && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY data ./data
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["node", "dist/server.js"]
