FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8

LABEL org.opencontainers.image.source=https://github.com/GMOD/Apollo3
LABEL org.opencontainers.image.description="Apollo CLI"
RUN yarn global add @apollo-annotation/cli
ENV APOLLO_DISABLE_CONFIG_CREATE=1
ENTRYPOINT ["apollo"]
