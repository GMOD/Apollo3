Apollo 3 Deployment

## Full deployment with collaboration server

<!-- vim-markdown-toc GFM -->

* [Basic components](#basic-components)
* [Deploying with Docker](#deploying-with-docker)
    * [Name](#name)
    * [Volumes](#volumes)
    * [Services](#services)
        * [Client](#client)
        * [Apollo Collaboration Server](#apollo-collaboration-server)
        * [MongoDB](#mongodb)
* [Starting everything](#starting-everything)
* [Deploying](#deploying)

<!-- vim-markdown-toc -->

Apollo can be used in some cases on local files with no need to set up a server,
but this guide will focus on deploying Apollo with all the components needed for
a hosted server that allows collaborative annotation.

### Basic components

<dl>
  <dt>JBrowse</dt>
  <dd>
    The Apollo user interface is a JBrowse plugin, so a server hosting the
    JBrowse code is needed.
  </dd>
  <dd>
    Since JBrowse is a client-side app, the requirements for serving it are low.
    All you need is a simple static file server. For example, JBrowse can be
    served by uploading the app's files into an Amazon S3 bucket and then making
    them publicly available.
  </dd>
  <dd>
    For most Apollo installations, though, it's easier to serve JBrowse with a
    static file server on the same machine that is running the Apollo
    Collaboration Server.
  </dd>
  <dt>Apollo JBrowse Plugin</dt>
  <dd>
    The code for the JBrowse plugin that adds Apollo functionality also needs to
    be hosted by a server somewhere. This is a single file that has the same
    hosting requirements as the JBrowse app. It's usually easiest to copy this
    code to the same place the JBrowse code is hosted and use its same file
    server.
  </dd>
  <dt>Apollo Collaboration Server</dt>
  <dd>
    This server is what the Apollo JBrowse plugin connects to in order to
    retrieve data as well as send requests to modify data.
  </dd>
  <dd>
    The server requires Node.js 18 or higher to run as well as at least two CPU
    cores and 2GB Memory for basic usage. More memory may be needed for larger
    assemblies or several concurrent users. The server also needs access to a
    location on its file system to save uploaded files. The size of hard drive
    it needs is dependant on how many files will need to be uploaded.
  </dd>
  <dt>MongoDB Database</dt>
  <dd>
    The Apollo Collaboration Server stores its data in a MongoDB database. Since
    the server uses some specialized MongoDB functionality, the database needs
    to be in a replica set configuration. The database can be on the same
    machine as the collaboration server, or it can be external.
  </dd>
</dl>

### Deploying with Docker

One possible deployment strategy, which we use internally to deploy the Apollo
demo website, is to use Docker as a deployment strategy. That way the only thing
the host machine needs to have installed on it is Docker, and the rest of the
packages and configurations can be taken care of using Docker. This guide will
cover some of the basics of Docker as part of describing the deployment, but if
you are unfamiliar with Docker it might be useful to see an overview of what it
does [here](https://docs.docker.com/get-started/overview/).

Docker Compose is especially useful for this type of deployment, since it allows
us to use multiple Docker containers, each with its own specialized role, and
coordinate them with a `compose.yml` file.

A sample `compose.yml` file is available [here](compose.yml), and in this guide
we'll break down each of the sections and what is being done in each. In this
guide we'll assume you're first creating these files on your local computer, and
then we'll discuss how to deploy them to your server.

#### Name

At the top of the example file is `name: apollo-demo-site`. You can rename this
or even remove it, it's mostly there as an easy-to-recognize name in various
Docker command outputs.

#### Volumes

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

#### Services

Services are where most of the configuration is done in the compose file. Each
entry in the `services` section will be run as a separate Docker container, and
the service names can be used so that different services can refer to each
other.

##### Client

We'll start by describing the `client` service. Here is the section from the
compose file:

```yml
client:
  build:
    args:
      APOLLO_VERSION: 0.1.0
      JBROWSE_VERSION: 2.10.3
      FORWARD_HOSTNAME: apollo-collaboration-server
      FORWARD_PORT: 3999
    context: .
  depends_on:
    - apollo-collaboration-server
  ports:
    - '80:80'
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
located next to the `compose.yml` in the filesystem. There is an example
Dockerfile [here](Dockerfile) which configures the file server, downloads the
specified versions of Apollo and JBrowse, and adds the JBrowse and Apollo
configuration. The `FORWARD_HOSTNAME` and `FORWARD_PORT` args should match the
service name and port of the Apollo Collaboration Server service (described in
the next section).

The configuration added to the `httpd.conf` file in that Dockerfile makes it so
that any request that comes to the server that doesn't match a file hosted on
the server is forwarded to the Apollo Collaboration Server.

The `depends_on` section makes sure the collaboration server has started before
starting the client, and the `port` section makes the container's server
available outside the container on port 80.

##### Apollo Collaboration Server

The next service is the Apollo server component. Here is its section of the
compose file:

```yml
apollo-collaboration-server:
  image: ghcr.io/gmod/apollo-collaboration-server:development
  depends_on:
    mongo-node-1:
      condition: service_healthy
  env_file: .env
  environment:
    MONGODB_URI: mongodb://mongo-node-1:27017,mongo-node-2:27018/apolloDb?replicaSet=rs0
    FILE_UPLOAD_FOLDER: /data/uploads
    ALLOW_GUEST_USER: true
    URL: http://my-apollo-site.org
    JWT_SECRET: change_this_value
    SESSION_SECRET: change_this_value
  ports:
    - 3999:3999
  volumes:
    - uploaded-files-volume:/data/uploads
```

This service uses a published Docker image for its container. It also uses
`depends_on` to ensure that the database is started and in a healthy state
before starting the collaboration server, and defines which port the app is
exposed on.

The collaboration server is configured with environment variables, often in a
`.env` file. However, we use the `environment` option to set a couple variables
whose value depends on other places in the compose file, to try to keep the
related options all in one place. These two variables are `MONGODB_URI` and
`FILE_UPLOAD_FOLDER`. The example URI is
`mongodb://mongo-node-1:27017,mongo-node-2:27018/apolloDb?replicaSet=rs0`. If
you change the names of either of the MongoDB services, their ports, or add or
remove a MongoDB service, be sure to update this value. The value of
`FILE_UPLOAD_FOLDER` should match what's on the right side of the colon in the
`volumes` section (e.g. `/data/uploads`).

There are a few other variables that need to be configured for the Apollo
Collaboration Server to work. They are `URL`, `JWT_SECRET`, and `SESSION_SECRET`
variables. `URL` is the URL of the server that's hosting Apollo. We'll discuss
this more in a later section when talking about authentication. You can think of
`JWT_SECRET` and `SESSION_SECRET` as kind of like passwords. They need to be a
random string, but should be the same each time you run the server so that user
sessions are not invalidated (unless you want to intentionally invalidate user
sessions). You can use a password generator to create them.

You can put these variables in the `environment` section, or you can put them in
a `.env` file, which has a format that looks like this

```env
URL=https://my-apollo-site.org
```

There are several other options you can configure. You can see [this](.env)
sample `.env` file for a description of the other configuration options. For
now, we will set `ALLOW_GUEST_USER` to be true to simplify testing.

##### MongoDB

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

### Starting everything

Once you have your `compose.yml`, `Dockerfile`, and optionally `.env` file set
up, you can start everything up to see if it works. Do this by opening up the
terminal in the directory where your compose file is and running
`docker compose up`. You'll see a lot of log output, and after a bit you should
be able to open http://localhost/ in your browser and see the app. You can stop
the process with <kbd>Ctrl</kbd> + <kbd>C</kbd>.

You can then try running `docker compose up -d`. This starts the containers in
the background, so you won't see the log output you saw before. You can still
access the logs, though. For example, running `docker compose logs client` will
show you the logs generated by your "client" service.

To stop the containers after they started with the `-d` option, you can run
`docker compose down`.

### Deploying

There are a couple ways to deploy this app to your server. One option is to copy
all the file over and run `docker compse up -d` there. Another is to use Docker
Contexts (see
[here](https://docs.docker.com/engine/context/working-with-contexts/)), which
allows you to run a command locally that looks like
`docker --context apollo-server compose up -d` on your local computer, and it
will remotely run the command on your server.
