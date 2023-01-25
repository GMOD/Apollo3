# syntax=docker/dockerfile:1

FROM alpine AS setup
WORKDIR /app
COPY ["package.json", "yarn.lock", ".yarnrc.yml", "./"]
COPY [".yarn", "./.yarn"]
COPY packages packages
RUN find packages/ -type f \! \( -name "package.json" -o -name "yarn.lock" \) -delete
RUN find . -type d -empty -delete

FROM node:16 AS build
WORKDIR /app
COPY --from=setup /app .
RUN yarn install --immutable
COPY . .
WORKDIR /app/packages/jbrowse-plugin-apollo
RUN yarn build

FROM httpd:alpine
COPY --from=build /app/packages/jbrowse-plugin-apollo/dist /usr/local/apache2/htdocs
