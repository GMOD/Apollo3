# syntax=docker/dockerfile:1

FROM public.ecr.aws/p1r0y7k4/apollo-collaboration-server-alpha
RUN wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add - \
  && echo "deb http://repo.mongodb.org/apt/debian buster/mongodb-org/6.0 main" >> /etc/apt/sources.list.d/mongodb-org-6.0.list \
  && apt-get update \
  && apt-get install --yes apache2 mongodb-org \
  && mkdir --parents /data/db \
  && mongod --fork --syslog --replSet rs0 \
  && mongosh --eval 'rs.initiate()' \
  && touch /start.sh \
  && chmod +x /start.sh \
  && cat <<EOF >> /start.sh
#!/bin/bash
/usr/sbin/apachectl start
/usr/bin/mongod --fork --syslog --replSet rs0
cd /app/packages/apollo-collaboration-server
/usr/local/bin/yarn start:prod
EOF
COPY --from=public.ecr.aws/p1r0y7k4/jbrowse-web-apollo-alpha:latest /usr/local/apache2/htdocs /var/www/html
COPY --from=public.ecr.aws/p1r0y7k4/jbrowse-plugin-apollo-alpha:latest /usr/local/apache2/htdocs /var/www/html/plugin
CMD ["/start.sh"]
