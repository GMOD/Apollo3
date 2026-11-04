# Running several server containers

A single collaboration server process uses one CPU core. To serve more users,
you can run several copies of the collaboration server container, with Docker
Compose or Kubernetes. Live updates (changes, check results and user locations)
reach every user whichever copy they are connected to, and users don't need to
stay connected to the same copy, so no "sticky sessions" are needed.

To run several processes on one machine without containers, see
[Running several server processes with PM2](./03-pm2.md). Its "Things to know"
section also applies here.

## What every copy needs

- **The same MongoDB database.** Copies coordinate through it, including sending
  live updates to each other.
- **The same uploaded files.** Uploaded files are stored in
  `FILE_UPLOAD_FOLDER`, and a file uploaded to one copy may be read by another.
  On one machine, a shared Docker volume works. Across several machines, use
  storage that several machines can mount at once, such as NFS, Amazon EFS or a
  Kubernetes `ReadWriteMany` volume.
- **The same configuration**, in particular the same `URL`, `JWT_SECRET` and
  `SESSION_SECRET`.
- **The same Apollo version.** During an upgrade, old and new copies run side by
  side until the upgrade finishes. If the release notes for a new version
  mention database changes, stop all copies before starting the new version.

## Health checks

The collaboration server has two health check endpoints:

- `/health` responds with status 200 when the server can reach MongoDB and is
  receiving live updates from the other copies, and 503 otherwise. Use it to
  decide whether to send users to a copy, e.g. as a load balancer health check
  or Kubernetes readiness probe.
- `/health/live` responds with status 200 whenever the server is running. Use it
  to decide whether to restart a copy, e.g. as a Kubernetes liveness probe.
  Unlike `/health`, it doesn't fail when MongoDB is down, so a MongoDB outage
  doesn't restart every copy.

## Proxy settings

Live updates use a long-lived HTTP connection to `/messages/events`, and uploads
can be large. Whatever proxy or load balancer is in front of Apollo should

- not buffer responses
- allow requests that take a long time (an hour or more), since the live updates
  connection stays open
- allow large request bodies, for uploads

The server sends a small message every 30 seconds to keep the live updates
connection open.

When a container stops, the server finishes its current requests and closes live
updates connections, and users' browsers reconnect to another copy.

## Docker Compose

These instructions build on the
[Docker Compose example](./01-docker-compose.md). Docker Compose doesn't balance
connections between copies of a service, so add an nginx service to do that.

In `compose.yml`, change the `apollo-collaboration-server` service to run
several copies. Remove its `ports` section, since copies can't all use the same
port on the host. Then add the `apollo-balancer` service:

```yml title="compose.yml"
services:
  apollo-collaboration-server:
    image:
      ghcr.io/gmod/apollo-collaboration-server:${APOLLO_VERSION:?Please specify
      APOLLO_VERSION}
    depends_on:
      mongo:
        condition: service_healthy
    env_file: apollo.env
    deploy:
      replicas: 3
    healthcheck:
      test: curl --fail --silent http://localhost:3999/health
      interval: 30s
      start_period: 1m
    volumes:
      - uploaded-files-volume:/data/uploads
    restart: unless-stopped
  apollo-balancer:
    image: nginx:stable-alpine
    depends_on:
      - apollo-collaboration-server
    volumes:
      - ./apollo-balancer.conf:/etc/nginx/conf.d/default.conf:ro
    restart: unless-stopped
  # client and mongo services as before
```

Create `apollo-balancer.conf` next to `compose.yml`:

```nginx title="apollo-balancer.conf"
server {
  listen 3999;
  # Docker's DNS server. Looking up the service name on each request finds
  # every copy, including ones added later.
  resolver 127.0.0.11 valid=10s;
  set $apollo apollo-collaboration-server;

  location / {
    proxy_pass http://$apollo:3999;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_read_timeout 1h;
    proxy_send_timeout 1h;
    client_max_body_size 0;
  }
}
```

In the client's `Dockerfile`, change each `apollo-collaboration-server:3999` in
the `ProxyPass` lines to `apollo-balancer:3999`, then rebuild and start
everything with `docker compose up --detach --build`.

To change the number of copies while running, run

```sh
docker compose up --detach --scale apollo-collaboration-server=4
```

## Kubernetes

This is a minimal example. It assumes you already have

- a MongoDB database the cluster can reach
- a storage class that supports `ReadWriteMany` volumes
- the [ingress-nginx](https://kubernetes.github.io/ingress-nginx/) ingress
  controller (other ingress controllers have similar settings for the
  [proxy settings](#proxy-settings) above)

Store the secret settings in a Secret:

```sh
kubectl create secret generic apollo-secrets \
  --from-literal=MONGODB_URI='mongodb://mongo.example.org:27017/apolloDb' \
  --from-literal=JWT_SECRET='some-secret-value' \
  --from-literal=SESSION_SECRET='some-other-secret-value'
```

Instead of passing secrets as environment variables, you can also mount the
Secret as files and use the `_FILE` versions of the settings, e.g.
`JWT_SECRET_FILE` (see [Configuration options](../04-configuration-options.md)).

Then apply these resources, changing the image version, `URL`, `NAME`, storage
class and host name to suit your setup:

```yml title="apollo.yml"
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: apollo-uploads
spec:
  accessModes: [ReadWriteMany]
  storageClassName: nfs # a storage class that supports ReadWriteMany
  resources:
    requests:
      storage: 100Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: apollo-collaboration-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: apollo-collaboration-server
  template:
    metadata:
      labels:
        app: apollo-collaboration-server
    spec:
      # Give in-flight requests time to finish when stopping
      terminationGracePeriodSeconds: 30
      containers:
        - name: apollo-collaboration-server
          image: ghcr.io/gmod/apollo-collaboration-server:1.2.0
          ports:
            - containerPort: 3999
          env:
            - name: URL
              value: https://apollo.example.org/
            - name: NAME
              value: My Apollo Instance
            - name: FILE_UPLOAD_FOLDER
              value: /data/uploads
          envFrom:
            - secretRef:
                name: apollo-secrets
          volumeMounts:
            - name: uploads
              mountPath: /data/uploads
          readinessProbe:
            httpGet:
              path: /health
              port: 3999
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3999
            periodSeconds: 30
          startupProbe:
            httpGet:
              path: /health/live
              port: 3999
            periodSeconds: 5
            failureThreshold: 60
      volumes:
        - name: uploads
          persistentVolumeClaim:
            claimName: apollo-uploads
---
apiVersion: v1
kind: Service
metadata:
  name: apollo-collaboration-server
spec:
  selector:
    app: apollo-collaboration-server
  ports:
    - port: 3999
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: apollo-collaboration-server
  annotations:
    nginx.ingress.kubernetes.io/proxy-buffering: 'off'
    nginx.ingress.kubernetes.io/proxy-request-buffering: 'off'
    nginx.ingress.kubernetes.io/proxy-read-timeout: '3600'
    nginx.ingress.kubernetes.io/proxy-send-timeout: '3600'
    nginx.ingress.kubernetes.io/proxy-body-size: '0'
spec:
  ingressClassName: nginx
  rules:
    - host: apollo.example.org
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: apollo-collaboration-server
                port:
                  number: 3999
```

```sh
kubectl apply -f apollo.yml
```

JBrowse itself is a static website, which you can serve however you like, e.g.
as in the [Docker Compose example](./01-docker-compose.md), using the
collaboration server's URL.

To change the number of copies, run

```sh
kubectl scale deployment apollo-collaboration-server --replicas=4
```

You can also use a HorizontalPodAutoscaler. Users' live updates connections stay
with the copy they started on until they reconnect, so new copies take on
existing users gradually.
