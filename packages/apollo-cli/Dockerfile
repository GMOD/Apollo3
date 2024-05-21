FROM node:18-alpine3.19

RUN yarn global add @apollo-annotation/apollo-cli@devel
ENV APOLLO_DISABLE_CONFIG_CREATE=1 
ENTRYPOINT ["apollo"]
