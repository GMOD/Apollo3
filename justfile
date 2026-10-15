import? 'user.just'

# list recipes
default:
    just -l

# initial setup (run once)
setup: setup-jbrowse setup-apollo

# initial setup for jbrowse
[working-directory: '../jbrowse-components']
[private]
setup-jbrowse:
    yarn

# initial setup for apollo
[private]
setup-apollo:
    yarn
    [ -f packages/apollo-collaboration-server/.development.local.env ] || cp packages/apollo-collaboration-server/.development.local.env.example packages/apollo-collaboration-server/.development.local.env

# run everything
[parallel]
run: run-jbrowse run-shared run-collab run-plugin

# run jbrowse
[working-directory: '../jbrowse-components/products/jbrowse-web']
run-jbrowse:
    yarn start

# run apollo shared
run-shared:
    yarn --cwd packages/apollo-shared start

# run apollo collaboration server
run-collab:
    yarn --cwd packages/apollo-collaboration-server start --debug --watch

# run apollo jbrowse plugin
run-plugin:
    yarn --cwd packages/jbrowse-plugin-apollo start
