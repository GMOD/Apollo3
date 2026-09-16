# Background

A full deployment of a collaborative Apollo instance is made up of several
different components. When setting up Apollo, you'll have to decide how you want
to handle each of these components. We provide some examples of how to deploy
Apollo, but the deployment can be customized to fit your needs. For example, you
may want to utilize an existing MongoDB installation (perhaps managed by your
institution) and deploy the rest of Apollo using Docker.

Here we'll review the different parts of Apollo that each deployment strategy
will need to consider.

## Basic components

### JBrowse

The Apollo user interface is a JBrowse plugin, and JBrowse will need to be
hosted somewhere.

Since JBrowse is a client-side app, the requirements for serving it are low. All
you need is a simple static file server. For example, JBrowse can be served by
uploading the app's files into an Amazon S3 bucket and then making them publicly
available.

For most Apollo installations, though, it's easier to serve JBrowse with a
static file server on the same machine that is running the Apollo Collaboration
Server.

### Apollo JBrowse Plugin

The code for the JBrowse plugin that adds Apollo functionality also needs to be
hosted by a server somewhere. This is a single file that has the same hosting
requirements as the JBrowse app. It's usually easiest to copy this code to the
same place the JBrowse code is hosted and use its same file server.

### Apollo Collaboration Server

This server is what the Apollo JBrowse plugin connects to in order to retrieve
data as well as send requests to modify data.

The server requires Node.js 20 or higher to run as well as at least two CPU
cores and 2GB Memory for basic usage. More memory will likely be required for
larger assemblies or several concurrent users. The server also needs access to a
location on its file system to save uploaded files. The size of hard drive it
needs is dependent on how many files will need to be uploaded.

### MongoDB Database

The Apollo Collaboration Server stores its data in a MongoDB database. A plain,
single MongoDB instance is sufficient; no special configuration (such as a
replica set) is required. The database can be on the same machine as the
collaboration server, or it can be external.

## Deployment examples

- [Deploying with Docker](../installation/examples/docker-compose)
- [Deploying on Ubuntu](../installation/examples/ubuntu-server)

## Local development and testing

The deployment examples above use a separate static file server (apache2 or
httpd) in front of the Apollo Collaboration Server, which forwards it API
requests as well as the app's root page and `index.html`. For local development
or quick testing, you can skip the separate file server entirely: the
collaboration server can serve the JBrowse + Apollo JBrowse Plugin files itself.

To do this, set `JBROWSE_DIR` to a directory containing a JBrowse Web build
(with the Apollo plugin's `apollo.js` alongside it) — the same files you'd
otherwise unzip into apache2's or httpd's document root in the deployment
examples — and set `URL` to the collaboration server's own address (e.g.
`http://localhost:3999`, with no `/apollo/` path prefix). The collaboration
server will then serve everything from that single process: static assets are
served as plain files, while the root page and `index.html` are served
dynamically, reading the real file off disk and augmenting it with a small
script that redirects to the login page on a 401 from the Apollo API (and back
again once login succeeds) — the same behavior the reverse-proxy deployment
examples set up via their `ProxyPassMatch` rules for `/` and `/index.html`. Each
configured JBrowse config.json (see "Serving multiple JBrowse configurations"
below) is handled the same way too, served dynamically at its own literal path —
`/config.json` by default — matching the `ProxyPass "/config.json"` rule in
those same examples.

This mode is intended for local development and testing only. For a real
deployment, prefer a dedicated static file server or CDN in front of the
collaboration server, as described in the deployment examples above.

### Developing against a running JBrowse dev server

The `JBROWSE_DIR` mode above needs a _built_ JBrowse Web + Apollo plugin bundle
on disk. If you're instead actively developing JBrowse Web itself (e.g. running
`yarn start` in a jbrowse-components checkout), it serves everything from an
in-memory dev server rather than files on disk, so there's nothing for
`JBROWSE_DIR` to point at.

For this case, set `JBROWSE_DEV_SERVER_URL` instead of `JBROWSE_DIR` (the two
are mutually exclusive) to the address of that running dev server, e.g.
`http://localhost:3000`. The collaboration server will fetch `index.html` from
the dev server and augment it the same way as the on-disk mode, still serve each
configured config.json dynamically as usual, and forward every other request
(JS/CSS bundles, source maps, etc.) straight through to the dev server.

This is HTTP-only: the dev server's own live-reload/HMR WebSocket isn't
forwarded, so refresh the browser manually after a rebuild.

### Serving multiple JBrowse configurations

By default the collaboration server serves a single `config.json`. Set
`JBROWSE_CONFIG_FILES` to a comma-separated list of config.json filenames (all
resolved the same way as the default `config.json`, whether via `JBROWSE_DIR` or
`JBROWSE_DEV_SERVER_URL`) to host several JBrowse configurations — for example,
one per organism — from the same server and MongoDB database. Every assembly
across every listed file is seeded into MongoDB at startup, so any of them can
be requested regardless of which file a given session has selected.

Each listed filename is served, at its own literal path, as the Apollo-augmented
config — e.g. `JBROWSE_CONFIG_FILES=config.json,config_mouse.json` makes both
`/config.json` and `/config_mouse.json` augmented, with no extra query param
needed. To navigate a user to a specific configuration, point JBrowse Web's own
`config` query param on its top-level app URL (which points JBrowse Web at a
config.json URL to load, wherever it lives) straight at that file's path, e.g.
`https://host/?config=/config_mouse.json`. A path that isn't one of the
configured filenames is served as an ordinary static file (or 404s), so this
feature is entirely opt-in and doesn't change default behavior.

## Customizing your deployment

Our deployment examples cover setting up Apollo with the most common default
settings and guest user access. You'll most likely want to then configure user
logins, which we cover in our [Login Management](login-management) guide.

We also cover more options for customizing Apollo in our
[Configuration options](./configuration-options) guide.
