FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
              /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    && groupadd --system --gid 10001 pclapp \
    && useradd --system --uid 10001 --gid pclapp --no-create-home --shell /usr/sbin/nologin pclapp
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5000
COPY --from=deps --chown=root:pclapp /app/node_modules ./node_modules
COPY --chown=root:pclapp . .
USER 10001:10001
EXPOSE 5000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "Server.js"]
