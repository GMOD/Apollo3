# Setting up

To run this demo, you'll need to have
[Docker](//docs.docker.com/engine/install/) and
[Docker Compose](//docs.docker.com/compose/install/) installed.

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

You'll now have a folder called `data/` in your directory.

## Setting up the Apollo CLI

The Apollo CLI is used to configure and load data into Apollo. We'll need a
config file for our CLI configuration. For simplicity, we'll create an empty
file called `config.yml` in a new directory.

```sh
mkdir cli
touch cli/config.yml
```

We'll use Docker to run the Apollo CLI. To avoid having to re-type the Docker
commands, we use this function:

```sh
function apollo() {
  docker \
    run \
    --rm \
    --interactive \
    --add-host host.docker.internal=host-gateway \
    --volume ./cli:/root/.config/apollo-cli \
    --volume ./data:/data \
    ghcr.io/gmod/apollo-cli \
    "$@"
}
```

Paste and run the above command in your terminal to create the function, then
run `apollo version` in your terminal. You should see something like this
output:

```
$ apollo --version
@apollo-annotation/cli/0.1.20 linux-x64 node-v18.20.4
```

:::tip

If you're familiar with installing Node.js packages you can install the Apollo
CLI instead of using Docker.

```bash npm2yarn
npm install -g @apollo-annotation/cli
```

:::

## Running Apollo

Create a file called `config.yml` and paste the following contents into the
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
        wget https://github.com/GMOD/jbrowse-components/releases/download/v2.15.4/jbrowse-web-v2.15.4.zip
        unzip -o jbrowse-web-v2.15.4.zip
        rm jbrowse-web-v2.15.4.zip
        wget --output-document=- --quiet https://registry.npmjs.org/@apollo-annotation/jbrowse-plugin-apollo/-/jbrowse-plugin-apollo-0.1.21.tgz | \
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

Now in the terminal, run `cd apollo3-annotation/` and `docker compose up`.
Apollo is now running! You can use <kbd>Ctrl</kbd> + <kbd>C</kbd> to stop it
when you are done.
