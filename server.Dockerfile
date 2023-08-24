# syntax=docker/dockerfile:1

FROM alpine AS setup
WORKDIR /app
COPY ["package.json", "yarn.lock", ".yarnrc.yml", "./"]
COPY [".yarn", ".yarn"]
COPY packages packages
RUN find packages/ -type f \! \( -name "package.json" -o -name "yarn.lock" \) -delete
RUN find . -type d -empty -delete

FROM node:18
WORKDIR /app
COPY --from=setup /app .
RUN yarn install --immutable
COPY . .
WORKDIR /app/packages/apollo-collaboration-server
RUN yarn build
EXPOSE 3999
CMD ["yarn", "start:prod"]
