# Deploying with Docker Compose

One way to deploy Apollo is to use Docker Compose to organize all the needed
pieces. This is what the Apollo developers use to deploy our demo Apollo site.

## Prerequisites

- A Linux server
  - Need terminal (SSH) and HTTP(S) access
- A domain name for the server
  - This guide assumes you are using the top level of the domain, so e.g. if
    your domain name is `example.com`, you won't be able to have Apollo be at
    `example.com/apollo`. Subdomains are fine, though, so you could use
    `apollo.example.com`
- Docker (with docker-compose)
- Node.js

Apollo 3 is not limited to running on Linux, but this guide assumes a Linux
environment for simplicity. Docker must be installed on the server, as well as
the Docker Compose plugin. Some systems install this plugin by default when
Docker is installed. You can check if the Compose plugin is installed by running
`docker compose version` and checking if it properly displays a version.

The process for getting and assigning a domain name to your server will vary
based on your setup, but if for example you are using AWS, you could use Route
53 to define an A type record that points to the public IP address of your EC2
instance.

## Initial setup

Create three files on your server called `apollo.env`, `compose.yml`, and
`Dockerfile`. The location of the files doesn't matter, and for this guide we'll
assume you've created them in a directory called `apollo/` in your home
directory.

```sh
cd ~
mkdir apollo
cd apollo/
touch compose.yml apollo.env Dockerfile
```

Using whatever file editing method you'd like, copy the contents of these sample
files into `apollo.env`, `compose.yml`, and `Dockerfile`.

```sh title="apollo.env"
URL=http://example.com/apollo/
NAME=My Apollo Instance
MONGODB_URI=mongodb://mongo-node-1:27017,mongo-node-2:27018/apolloDb?replicaSet=rs0
FILE_UPLOAD_FOLDER=/data/uploads
JWT_SECRET=some-secret-value
SESSION_SECRET=some-other-secret-value
ALLOW_ROOT_USER=true
ROOT_USER_PASSWORD=some-secret-password
ALLOW_GUEST_USER=true
```

```yml title="compose.yml"
name: my-apollo-site

services:
  apollo-collaboration-server:
    image: ghcr.io/gmod/apollo-collaboration-server
    depends_on:
      mongo-node-1:
        condition: service_healthy
    env_file: apollo.env
    ports:
      - 3999:3999
    volumes:
      - uploaded-files-volume:/data/uploads
    restart: unless-stopped

  client:
    build:
      args:
        JBROWSE_VERSION: 2.18.0
        JBROWSE_VERSION: 0.2.2
      context: .
    depends_on:
      - apollo-collaboration-server
    ports:
      - '80:80'
    volumes:
      - /home/ec2-user/deployment/data/:/usr/local/apache2/htdocs/data/
      - /home/ec2-user/deployment/demoData/:/usr/local/apache2/htdocs/demoData/
    restart: unless-stopped

  mongo-node-1:
    image: mongo:7
    command:
      - '--replSet'
      - rs0
      - '--bind_ip_all'
      - '--port'
      - '27017'
    healthcheck:
      interval: 30s
      retries: 3
      start_interval: 5s
      start_period: 2m
      test: |
        mongosh --port 27017 --quiet --eval "
        try {
          rs.status()
          console.log('replica set ok')
        } catch {
          rs.initiate({
            _id: 'rs0',
            members: [
              { _id: 0, host: 'mongo-node-1:27017', priority: 1 },
              { _id: 1, host: 'mongo-node-2:27018', priority: 0.5 },
            ],
          })
          console.log('replica set initiated')
        }
        "
      timeout: 10s
    ports:
      - '27017:27017'
    volumes:
      - mongo-node-1_data:/data/db
      - mongo-node-1_config:/data/configdb
    restart: unless-stopped

  mongo-node-2:
    image: mongo:7
    command:
      - '--replSet'
      - rs0
      - '--bind_ip_all'
      - '--port'
      - '27018'
    ports:
      - '27018:27018'
    volumes:
      - mongo-node-2_data:/data/db
      - mongo-node-2_config:/data/configdb
    restart: unless-stopped

volumes:
  mongo-node-1_config: null
  mongo-node-1_data: null
  mongo-node-2_config: null
  mongo-node-2_data: null
  uploaded-files-volume: null
```

```Dockerfile title="Dockerfile"
FROM httpd:alpine
ARG JBROWSE_VERSION
ARG APOLLO_VERSION
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
wget --output-document jbrowse-web.zip https://github.com/GMOD/jbrowse-components/releases/download/v$JBROWSE_VERSION/jbrowse-web-v$JBROWSE_VERSION.zip
unzip -o jbrowse-web.zip
rm jbrowse-web.zip
wget --output-document=- --quiet https://registry.npmjs.org/@apollo-annotation/jbrowse-plugin-apollo/-/jbrowse-plugin-apollo-$APOLLO_VERSION.tgz | \
tar --extract --gzip --file=- --strip=2 package/dist/jbrowse-plugin-apollo.umd.production.min.js
mv jbrowse-plugin-apollo.umd.production.min.js apollo.js
wget --quiet https://github.com/The-Sequence-Ontology/SO-Ontologies/raw/refs/heads/master/Ontology_Files/so.json
mv so.json sequence_ontology.json
EOF
```

Then we'll need to update a few values in `apollo.env`. Where it says
`URL=http://example.com`, replace `http://example.com` with the URL of your
server using the domain name mentioned above. You'll also need to change
`JWT_SECRET`. This value can be anything, but it's best if it's a secure random
value. One option is to use a password generator to create a password to put
here. The last value you'll need to change is `SESSION_SECRET`. This should also
be a random value, the same as `JWT_SECRET`. All the other entries in this file
can be left as they are for now.

## Details

Let's talk a bit about what's in the `compose.yml` file, which contains all the
pieces you need to run Apollo on a server.

### Name

At the top of the example file is `name: apollo-demo-site`. You can rename this
or even remove it, it's mostly there as an easy-to-recognize name in various
Docker command outputs.

### Volumes

Next we're going to skip to the bottom section called `volumes`. In this compose
file, we're using volumes to keep certain kinds of data around even if one of
the containers needs to be rebuild. For example, let's say you're using a
MongoDB container that uses v7.0.6 of MongoDB, but you want to upgrade to
v7.0.7. With Docker, instead of upgrading the running container, you usually
build a brand new container based on a Docker image that has the new version you
want. Volumes give Docker a place to store files outside the container, so a new
container can connect to the old volume and then all your data is still in your
database with your upgraded container.

In the example `compose.yml`, we use simple entries like
`mongo-node-1_config: null` means that we are defining a volume with the name
"mongo-node-1_config" that we can refer to elsewhere in the compose file.

### Services

Services are where most of the configuration is done in the compose file. Each
entry in the `services` section will be run as a separate Docker container, and
the service names can be used so that different services can refer to each
other.

#### Client

We'll start by describing the `client` service. Here is the section from the
compose file:

```yml
client:
  build:
    args:
      JBROWSE_VERSION: 2.18.0
      JBROWSE_VERSION: 0.2.2
    context: .
  depends_on:
    - apollo-collaboration-server
  ports:
    - '80:80'
  volumes:
    - /home/ec2-user/deployment/data/:/usr/local/apache2/htdocs/data/
    - /home/ec2-user/deployment/demoData/:/usr/local/apache2/htdocs/demoData/
  restart: unless-stopped
```

This service will be a static file server that serves the JBrowse and Apollo
JBrowse Plugin code. We're using Apache (`httpd`) in this example, but if you
know how to properly configure it, you could use NGINX as well.

The `build` section included here means that instead of using a pre-built Docker
image, this container will use an image built from a Dockerfile. The reason we
don't publish a pre-built container for this service is that it would be
complicated to organize and publish images with every combination of Apollo and
JBrowse versions, and it's much easier to download the exact versions you
specify when deploying your app.

Docker Compose will expect this Dockerfile to be named `Dockerfile` and be
located next to the `compose.yml` in the filesystem. The above Dockerfile
configures the file server, downloads the specified versions of Apollo and
JBrowse, and adds the JBrowse and Apollo configuration.

The configuration added to the `httpd.conf` file in that Dockerfile makes it so
that any request that starts with the path `/apollo/` gets sent to the
collaboration server, while any other requests are handled normally by Apache.

The `depends_on` section makes sure the collaboration server has started before
starting the client, and the `port` section makes the container's server
available outside the container on port 80.

#### Apollo Collaboration Server

The next service is the Apollo server component. Here is its section of the
compose file:

```yml
apollo-collaboration-server:
  image: ghcr.io/gmod/apollo-collaboration-server
  depends_on:
    mongo-node-1:
      condition: service_healthy
  env_file: apollo.env
  ports:
    - 3999:3999
  volumes:
    - uploaded-files-volume:/data/uploads
  restart: unless-stopped
```

This service uses a published Docker image for its container. It also uses
`depends_on` to ensure that the database is started and in a healthy state
before starting the collaboration server, and defines which port the app is
exposed on.

The collaboration server is configured with environment variables, often in a
`.env` file. Here we use `apollo.env` as the name of our environment variable
file. You could also specify the environment variables inline under an
`environment` section in the service.

Let's talk about a few of the options for the collaboration server specified in
the `.env` file:

##### `NAME`

A name for your Apollo instance. It is shown in the UI during the login process.

##### `MONGODB_URI`

In this example, it is
`mongodb://mongo-node-1:27017,mongo-node-2:27018/apolloDb?replicaSet=rs0`. If
you change the names of either of the MongoDB services, their ports, or add or
remove a MongoDB service, be sure to update this value.

##### `FILE_UPLOAD_FOLDER`

This should match what's on the right side of the colon in the `volumes` section
(e.g. `/data/uploads`).

##### `URL`

The URL of the server that's hosting Apollo.

##### `JWT_SECRET` and `SESSION_SECRET`

You can think of these as kind of like passwords. They need to be a random
string, but should be the same each time you run the server so that user
sessions are not invalidated (unless you want to intentionally invalidate user
sessions). You can use a password generator to create them.

#### MongoDB

MongoDB needs to be in a replica set configuration for the Apollo Collaboration
Server to work properly. MongoDB replica sets are intended to ensure
uninterrupted connection to the database even if one database node goes down. In
our case we're running all our nodes on the same server, so some of that
protection is lost, but we still run two different node containers so if one
container goes down, the database can still be accessed. We're using two nodes,
although you can use only a single node if you like. If you need high
availability in a production environment, you might need more nodes hosted on
different servers. In that case you could delete the MongoDB sections from the
compose file and update the `MONGODB_URI` variable in the collaboration server
appropriately.

Here is one of the MongoDB service entries:

```yml
mongo-node-1:
  image: mongo:7
  command:
    - '--replSet'
    - rs0
    - '--bind_ip_all'
    - '--port'
    - '27017'
  healthcheck:
    interval: 30s
    retries: 3
    start_interval: 5s
    start_period: 2m
    test: |
      mongosh --port 27017 --quiet --eval "
      try {
        rs.status()
        console.log('replica set ok')
      } catch {
        rs.initiate({
          _id: 'rs0',
          members: [
            { _id: 0, host: 'mongo-node-1:27017', priority: 1 },
            { _id: 1, host: 'mongo-node-2:27018', priority: 0.5 },
          ],
        })
        console.log('replica set initiated')
      }
      "
    timeout: 10s
  ports:
    - '27017:27017'
  volumes:
    - mongo-node-1_data:/data/db
    - mongo-node-1_config:/data/configdb
```

This uses the official MongoDB image, runs on port 27017, and uses two volumes
to store data and configuration in. The second node is almost identical, with a
different and and port and without the `healthcheck` section.

The `healthcheck` section is there to initialize the replica set the first time
the container runs, and then to provide a way for the collaboration server to
know the database is healthy and ready for requests from the app.

## Starting Apollo

We're now ready to start Apollo. Inside your `~/apollo/` directory, run this
command:

```sh
docker compose up
```

You should see logs start to print to the screen as the various pieces start up.
Once you've confirmed that everything starts without errors, go ahead and press
<kbd>Ctrl</kbd> + <kbd>C</kbd> to stop everything. Now run a command very
similar to the one run before:

```sh
docker compose up -d
```

The `-d` instructs Docker to run in detached mode, so instead of seeing logs
printed to the screen, the command will exit, and Apollo is now running in the
background. You can see same logs as before by running

```sh
docker compose logs
```

And, you can stop Apollo by running

```sh
docker compose down
```

We are now ready to access Apollo. Open a web browser and got the URL you
entered in the `apollo.env` file above. You should see a JBrowse instance with a
prompt to log in as a guest. You should see a view with an assembly selector,
but there aren't any assemblies yet. You're now ready to head over to our
[Admin guide](../../../category/admin) to learn how to load data into Apollo.
