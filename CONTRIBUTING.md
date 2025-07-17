# Local development

This documentation assumes both `jbrowse-components` and `Apollo3` are cloned
side-by-side:

```sh
git clone https://github.com/GMOD/jbrowse-components
git clone https://github.com/GMOD/Apollo3
```

You'll need `yarn` to be installed.

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
