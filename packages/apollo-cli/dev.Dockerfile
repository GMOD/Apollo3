# syntax=docker/dockerfile:1

FROM node:20-alpine AS setup
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ .yarn/
COPY packages/ packages/
RUN find packages/ -type f \! \( -name "package.json" -o -name "yarn.lock" \) -delete && \
find . -type d -empty -delete

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=setup /app .
RUN yarn install --immutable
COPY . .
WORKDIR /app/packages/apollo-shared
RUN yarn build
WORKDIR /app/packages/apollo-cli
RUN yarn build

FROM node:20-alpine
LABEL org.opencontainers.image.source=https://github.com/GMOD/Apollo3
LABEL org.opencontainers.image.description="Apollo CLI"
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ .yarn/
COPY packages/apollo-cli packages/apollo-cli
COPY --from=build /app/packages/apollo-cli/dist ./packages/apollo-cli/dist
RUN yarn workspaces focus --production @apollo-annotation/cli
WORKDIR /app/packages/apollo-cli
ENV APOLLO_DISABLE_CONFIG_CREATE=1
ENTRYPOINT ["yarn", "node", "bin/run.js"]
