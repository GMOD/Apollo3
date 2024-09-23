FROM node:18-alpine3.19

LABEL org.opencontainers.image.source=https://github.com/GMOD/Apollo3
LABEL org.opencontainers.image.description="Apollo CLI"
RUN yarn global add @apollo-annotation/cli
ENV APOLLO_DISABLE_CONFIG_CREATE=1
ENTRYPOINT ["apollo"]
