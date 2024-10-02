# syntax=docker/dockerfile:1

FROM node:18-alpine AS setup
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ .yarn/
COPY packages/ packages/
RUN find packages/ -type f \! \( -name "package.json" -o -name "yarn.lock" \) -delete
RUN find . -type d -empty -delete

FROM node:18-alpine AS build
WORKDIR /app
COPY --from=setup /app .
RUN yarn install --immutable
COPY . .
WORKDIR /app/packages/apollo-collaboration-server
RUN yarn build

FROM node:18-alpine
LABEL org.opencontainers.image.source=https://github.com/GMOD/Apollo3
LABEL org.opencontainers.image.description="Apollo collaboration server"
WORKDIR /app
COPY --from=build /app/packages/apollo-collaboration-server/dist /app/packages/apollo-collaboration-server/dist
COPY --from=build /app/packages/apollo-common/dist /app/packages/apollo-common/dist
COPY --from=build /app/packages/apollo-mst/dist /app/packages/apollo-mst/dist
COPY --from=build /app/packages/apollo-schemas/dist /app/packages/apollo-schemas/dist
COPY --from=build /app/packages/apollo-shared/dist /app/packages/apollo-shared/dist
COPY --from=build /app/packages/apollo-shared/package.json /app/packages/apollo-shared/package.json
COPY --from=build /app/packages/apollo-schemas/package.json /app/packages/apollo-schemas/package.json
COPY --from=build /app/packages/apollo-mst/package.json /app/packages/apollo-mst/package.json
COPY --from=build /app/packages/apollo-common/package.json /app/packages/apollo-common/package.json
COPY --from=build /app/packages/apollo-collaboration-server/package.json /app/packages/apollo-collaboration-server/package.json
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/yarn.lock /app/yarn.lock
COPY --from=build /app/.yarnrc.yml /app/.yarnrc.yml
COPY --from=build /app/.yarn/ /app/.yarn/
RUN yarn workspaces focus --production @apollo-annotation/collaboration-server

EXPOSE 3999
CMD ["yarn", "start:prod"]
