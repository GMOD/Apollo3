# syntax=docker/dockerfile:1

FROM node:24 AS setup
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ .yarn/
COPY packages/ packages/
RUN find packages/ -type f \! \( -name "package.json" -o -name "yarn.lock" \) -delete && \
find . -type d -empty -delete

FROM node:24 AS build
WORKDIR /app
COPY --from=setup /app .
RUN yarn install --immutable
COPY . .
WORKDIR /app/packages/apollo-collaboration-server
RUN yarn build

FROM node:24
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
WORKDIR /app/packages/apollo-collaboration-server
ENV NODE_ENV=production
EXPOSE 3999
# Run node directly instead of through `yarn start:prod`, since yarn exits as
# soon as it gets SIGTERM, which stops the container before the server has
# shut down cleanly. The server handles signals itself, so it needs no init
# process.
CMD ["node", "--require", "/app/.pnp.cjs", "--experimental-loader", "/app/.pnp.loader.mjs", "dist/main.js"]
