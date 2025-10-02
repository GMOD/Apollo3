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
needs is dependant on how many files will need to be uploaded.

### MongoDB Database

The Apollo Collaboration Server stores its data in a MongoDB database. Since the
server uses some specialized MongoDB functionality, the database needs to be in
a replica set configuration. The database can be on the same machine as the
collaboration server, or it can be external.

## Deployment examples

- [Deploying with Docker](../installation/examples/docker-compose)
- [Deploying on Ubuntu](../installation/examples/ubuntu-server)

## Customizing your deployment

Our deployment examples cover setting up Apollo with the most common default
settings and guest user access. You'll most likely want to then configure user
logins, which we cover in our [Login Management](login-management) guide.

We also cover more options for customizing Apollo in our
[Configuration options](./configuration-options) guide.
