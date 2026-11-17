FROM node:26-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216

LABEL org.opencontainers.image.source=https://github.com/GMOD/Apollo3
LABEL org.opencontainers.image.description="Apollo CLI"
RUN yarn global add @apollo-annotation/cli
ENV APOLLO_DISABLE_CONFIG_CREATE=1
ENTRYPOINT ["apollo"]
