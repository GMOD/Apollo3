FROM node:24
LABEL org.opencontainers.image.source=https://github.com/GMOD/Apollo3
LABEL org.opencontainers.image.description="Apollo collaboration server"
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ .yarn/
COPY packages/apollo-collaboration-server packages/apollo-collaboration-server
COPY packages/apollo-common packages/apollo-common
COPY packages/apollo-mst packages/apollo-mst
COPY packages/apollo-schemas packages/apollo-schemas
COPY packages/apollo-shared packages/apollo-shared
RUN yarn workspaces focus --production @apollo-annotation/collaboration-server
EXPOSE 3999
CMD ["yarn", "start:prod"]
