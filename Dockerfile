# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e

FROM node:24@sha256:8fa96264f302f58bbb13aa7339c541547b56975766ce956c875da149452a3e40 AS setup
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ .yarn/
COPY packages/ packages/
RUN find packages/ -type f \! \( -name "package.json" -o -name "yarn.lock" \) -delete && \
find . -type d -empty -delete

FROM node:24@sha256:8fa96264f302f58bbb13aa7339c541547b56975766ce956c875da149452a3e40 AS build
WORKDIR /app
COPY --from=setup /app .
RUN yarn install --immutable
COPY . .
WORKDIR /app/packages/apollo-collaboration-server
RUN yarn build

FROM node:24@sha256:8fa96264f302f58bbb13aa7339c541547b56975766ce956c875da149452a3e40
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
EXPOSE 3999
CMD ["yarn", "start:prod"]
