FROM node:24-alpine

LABEL org.opencontainers.image.source=https://github.com/GMOD/Apollo3
LABEL org.opencontainers.image.description="Apollo CLI"
RUN yarn global add @apollo-annotation/cli
ENV APOLLO_DISABLE_CONFIG_CREATE=1
ENTRYPOINT ["apollo"]
