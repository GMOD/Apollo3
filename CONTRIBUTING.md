# Local development

This documentation assumes both `jbrowse-components` and `Apollo3` are cloned
side-by-side:

```sh
git clone https://github.com/GMOD/jbrowse-components
git clone https://github.com/GMOD/Apollo3
```

You'll need `yarn` and `pnpm` to be installed. Apollo3 uses `yarn` (Berry),
while jbrowse-components uses `pnpm`. Both can be managed via `corepack`:

```sh
corepack enable
corepack prepare yarn@4.16.0 --activate
corepack prepare pnpm@11.11.0 --activate
```

You then have two options to start Apollo3 for development purposes. In both
cases, the instance is then accessible via

http://localhost:3000/?config=http://localhost:3999/jbrowse/config.json

## In a container via Visual Studio Code

If you use Visual Studio Code, you can leverage the _Dev Containers_ extension.
You'll need `docker` to be installed.

- Run `yarn` at the root of both repositories, this only needs to be ran once
  after cloning (alternatively, run the `just setup` recipe, see below).
- Run `yarn start` from `jbrowse-components/products/jbrowse-web`
  (alternatively, run the `just run-jbrowse` recipe).
- Open the Apollo3 project in Visual Studio Code.
- Use the _Dev Containers: Reopen in Container_ command in VS Code
  (`Ctrl + Shift + P` to search for commands).
- Use the _Task: Run Task -> Start_ command in VS Code

## Directly on the development computer

You'll need a MongoDB server running. For convenience, a `justfile` leveraging
[the `just` command runner](https://just.systems/man/en/) is provided. `just`
commands can be executed from anywhere within your local clone of `Apollo3`. You
can run `just` to get a list of available recipes.

- Run `just setup` (only once after cloning).
- Run `just run` (this automatically starts `jbrowse` and the Apollo
  components).

You can also define your own recipes in a `user.just` file, they will be added
to the list of available recipes. For instance, on a Linux system, you might
find the following recipes useful to have in your `user.just` file:

```just
# start mongodb server
start-mongodb:
    sudo systemctl start mongodb.service

# open in browser
open:
    xdg-open http://localhost:3000/?config=http://localhost:3999/jbrowse/config.json
```

## Running MongoDB with Docker

If you don't have MongoDB installed locally, you can run it via Docker:

```sh
docker run -d --name apollo-mongo -p 27017:27017 mongo:8 \
  --replSet rs0 --setParameter "transactionLifetimeLimitSeconds=300"
```

Then initialize the replica set:

```sh
docker exec apollo-mongo mongosh --eval \
  'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'
```

## Troubleshooting

**Puppeteer/Chrome download fails in jbrowse-components:**

```sh
PUPPETEER_SKIP_DOWNLOAD=true pnpm install --no-optional --ignore-scripts
```

**Canvas native module build fails (missing system dependencies):**

On Ubuntu/Debian:

```sh
sudo apt-get install pkg-config libcairo2-dev libpango1.0-dev \
  libjpeg-dev libgif-dev librsvg2-dev
```

Then re-run `pnpm install`.
