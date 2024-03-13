# syntax=docker/dockerfile:1

FROM alpine AS setup
WORKDIR /app
COPY ["package.json", "yarn.lock", ".yarnrc.yml", "./"]
COPY [".yarn", "./.yarn"]
COPY packages packages
RUN find packages/ -type f \! \( -name "package.json" -o -name "yarn.lock" \) -delete
RUN find . -type d -empty -delete

FROM node:18 AS build
WORKDIR /app
COPY --from=setup /app .
RUN yarn install --immutable
COPY . .
WORKDIR /app/packages/jbrowse-plugin-apollo
RUN yarn build

FROM httpd:alpine
LABEL org.opencontainers.image.source=https://github.com/GMOD/Apollo3
LABEL org.opencontainers.image.description="Apollo JBrowse plugin"
COPY --from=build /app/packages/jbrowse-plugin-apollo/dist /usr/local/apache2/htdocs
COPY ./docker/httpd.conf /usr/local/apache2/conf/httpd.conf
ADD https://github.com/GMOD/jbrowse-components/releases/download/v2.10.3/jbrowse-web-v2.10.3.zip /usr/local/apache2/htdocs/
WORKDIR /usr/local/apache2/htdocs/
RUN unzip -o jbrowse-web-v2.10.3.zip && rm jbrowse-web-v2.10.3.zip
