# Setting up

To run this demo, you'll need to have
[Docker](//docs.docker.com/engine/install/) (minimum version 27) and
[Docker Compose](//docs.docker.com/compose/install/) (minimum version 2.17.0)
installed, as well as [`jq`](https://jqlang.github.io/jq/).

We also recommend a Node.js package manager (such as `npm` or `yarn`) to make
things a easier, but we will provide directions for doing everything without one
that you can follow if you prefer.

## Getting the data

First download the
[demo data](//s3.us-east-1.amazonaws.com/jbrowse.org/apollo/data.zip) used for
this guide and put it in a directory where you can also put a couple other
files. For example:

```sh
mkdir apollo-demo/
cd apollo-demo/
wget https://s3.us-east-1.amazonaws.com/jbrowse.org/apollo/data.zip
unzip data.zip
rm data.zip
```

You'll now have two directories called `data/` and `jbrowse_data/`.

## Running Apollo

Create a file called `compose.yml` and paste the following contents into the
file:

```yml title="compose.yml"
name: apollo-local-testing
services:
  apollo-collaboration-server:
    image: 'ghcr.io/gmod/apollo-collaboration-server'
    depends_on:
      db:
        condition: service_healthy
    environment:
      NAME: My Local Testing Server
      URL: 'http://localhost/apollo/'
      MONGODB_URI: 'mongodb://db:27017/apolloDb?replicaSet=rs0'
      FILE_UPLOAD_FOLDER: /data/uploads
      ALLOW_GUEST_USER: true
      GUEST_USER_ROLE: admin
      ALLOW_ROOT_USER: true
      ROOT_USER_PASSWORD: password
      JWT_SECRET: local_testing_only
      SESSION_SECRET: local_testing_only
    ports:
      - '3999:3999'
    volumes:
      - 'uploads:/data/uploads'

  client:
    build:
      context: .
      dockerfile_inline: |
        FROM httpd:alpine
        COPY <<EOF /usr/local/apache2/conf/httpd.conf.append
        LogLevel debug
        LoadModule proxy_module modules/mod_proxy.so
        LoadModule proxy_http_module modules/mod_proxy_http.so
        LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so
        ProxyPass "/config.json" "http://apollo-collaboration-server:3999/jbrowse/config.json"
        ProxyPassReverse "/config.json" "http://apollo-collaboration-server:3999/jbrowse/config.json"
        ProxyPassMatch "^/apollo/(.*)$" "http://apollo-collaboration-server:3999/\$1" upgrade=websocket connectiontimeout=3600 timeout=3600
        ProxyPassReverse "/apollo/" "http://apollo-collaboration-server:3999/"
        EOF
        WORKDIR /usr/local/apache2/htdocs/
        RUN <<EOF
        set -o errexit
        set -o nounset
        set -o pipefail
        cat /usr/local/apache2/conf/httpd.conf.append >> /usr/local/apache2/conf/httpd.conf
        wget https://github.com/GMOD/jbrowse-components/releases/download/v2.18.0/jbrowse-web-v2.18.0.zip --output-document=jbrowse-web.zip
        unzip -o jbrowse-web.zip
        rm jbrowse-web.zip
        wget --output-document=- --quiet https://registry.npmjs.org/@apollo-annotation/jbrowse-plugin-apollo/-/jbrowse-plugin-apollo-0.3.4.tgz | \
        tar --extract --gzip --file=- --strip=2 package/dist/jbrowse-plugin-apollo.umd.production.min.js
        mv jbrowse-plugin-apollo.umd.production.min.js apollo.js
        wget --quiet https://github.com/The-Sequence-Ontology/SO-Ontologies/raw/refs/heads/master/Ontology_Files/so.json
        mv so.json sequence_ontology.json
        EOF
    depends_on:
      - apollo-collaboration-server
    ports:
      - '80:80'
    volumes:
      - './jbrowse_data:/usr/local/apache2/htdocs/data'

  db:
    image: 'mongo:7'
    command:
      - '--replSet'
      - rs0
      - '--bind_ip_all'
      - '--port'
      - '27017'
    healthcheck:
      interval: 30s
      retries: 3
      start_period: 2m
      test: |
        mongosh --port 27017 --quiet --eval "
        try {
          rs.status()
          console.log('replica set ok')
        } catch {
          rs.initiate()
          console.log('replica set initiated')
        }
        "
      timeout: 10s
    ports:
      - '27017:27017'
    volumes:
      - 'db_data:/data/db'
      - 'db_config:/data/configdb'

volumes:
  db_config: null
  db_data: null
  uploads: null
```

Now in the terminal, run `docker compose up`. You should see a stream of logs
from the Docker containers. If you do, Apollo is now running! You can use
<kbd>Ctrl</kbd> + <kbd>C</kbd> in the terminal to stop Apollo when you are done.
