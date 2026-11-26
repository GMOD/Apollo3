import? 'user.just'

# list recipes
default:
    just -l

# initial setup (run once)
setup: setup-apollo setup-jbrowse

# initial setup for apollo
[private]
setup-apollo:
    yarn
    [ -f packages/apollo-collaboration-server/.development.local.env ] || cp packages/apollo-collaboration-server/.development.local.env.example packages/apollo-collaboration-server/.development.local.env

# install the latest JBrowse Web release into .jbrowse
[working-directory: 'packages/jbrowse-plugin-apollo']
[private]
setup-jbrowse:
    [ -f .jbrowse/manifest.json ] || yarn jbrowse create .jbrowse

# run everything
[parallel]
run: run-jbrowse run-shared run-collab run-plugin

# serve jbrowse from .jbrowse on port 8999
run-jbrowse:
    yarn --cwd packages/jbrowse-plugin-apollo browse

# run apollo shared
run-shared:
    yarn --cwd packages/apollo-shared start

# run apollo collaboration server
run-collab:
    yarn --cwd packages/apollo-collaboration-server start --debug --watch

# run apollo jbrowse plugin
run-plugin:
    yarn --cwd packages/jbrowse-plugin-apollo start
