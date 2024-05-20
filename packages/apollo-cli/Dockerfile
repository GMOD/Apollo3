FROM node:18-alpine3.19

ARG USER_ID
ARG GROUP_ID

RUN addgroup -g $GROUP_ID apolloUser
RUN adduser -u $USER_ID -G apolloUser -g "" -D apolloUser

USER apolloUser
ENV PATH="/home/apolloUser/.yarn/bin:$PATH"
RUN yarn global add @apollo-annotation/apollo-cli@devel
ENTRYPOINT ["apollo"]
