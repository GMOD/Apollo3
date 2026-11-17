# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e

FROM node:26@sha256:438603bbb5cda404b9416f0b5c8026f61501ab911760d861ec28c36b5d675725 AS base
RUN npm install --global corepack@0.36.0 && corepack enable yarn
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Slim image for the final stage, which doesn't need the compilers and other
# tools in the full image used for building
FROM node:26-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc AS runtime
RUN npm install --global corepack@0.36.0 && corepack enable yarn
# Shared location so the yarn that corepack downloads at build time can be used
# by the non-root user at run time
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 COREPACK_HOME=/usr/local/share/corepack

FROM node:26@sha256:438603bbb5cda404b9416f0b5c8026f61501ab911760d861ec28c36b5d675725 AS setup
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ .yarn/
COPY packages/ packages/
RUN find packages/ -type f \! \( -name "package.json" -o -name "yarn.lock" \) -delete && \
find . -type d -empty -delete

FROM base AS build
WORKDIR /app
COPY --from=setup /app .
RUN yarn install --immutable
COPY . .
WORKDIR /app/packages/apollo-collaboration-server
RUN yarn build

FROM runtime
LABEL org.opencontainers.image.source=https://github.com/GMOD/Apollo3
LABEL org.opencontainers.image.description="Apollo collaboration server"
WORKDIR /app
COPY --from=setup /app .
COPY --from=build /app/packages/apollo-collaboration-server/dist /app/packages/apollo-collaboration-server/dist
COPY --from=build /app/packages/apollo-common/dist /app/packages/apollo-common/dist
COPY --from=build /app/packages/apollo-mst/dist /app/packages/apollo-mst/dist
COPY --from=build /app/packages/apollo-schemas/dist /app/packages/apollo-schemas/dist
COPY --from=build /app/packages/apollo-shared/dist /app/packages/apollo-shared/dist
RUN yarn workspaces focus --production @apollo-annotation/collaboration-server
# Run as the image's non-root `node` user (UID 1000)
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
EXPOSE 3999
CMD ["yarn", "start:prod"]
