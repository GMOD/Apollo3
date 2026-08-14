# Server configuration

```sh
##############
## REQUIRED ##
##############

# URL
URL=http://localhost:3999

# Name of your server (shown during the login process)
NAME=My Apollo Server

# MongoDB connection
MONGODB_URI=mongodb://127.0.0.1:27017/apolloDb
# Alternatively, can be a path to a file with the URI
# MONGODB_URI_FILE=/run/secrets/mongodb-uri

# Output folder for uploaded files
FILE_UPLOAD_FOLDER=./test/uploaded

# Secret used to encode JWT tokens
JWT_SECRET=84b5edd3-6c4e-42f3-9711-2f294c07df19
# Alternatively, can be a path to a file with the client secret
# JWT_SECRET_FILE=/run/secrets/jwt-secret

# Secret used to encode express sessions
SESSION_SECRET=g9fGaRuw06T7hs960Tm7KYyfcFaYEIaG9jfFnVEQ4QyFXmq7
# Alternatively, can be a path to a file with the session secret
# SESSION_SECRET_FILE=/run/secrets/session-secret

##############################################################################
## To enable users to log in, you need either (or both) Google or Microsoft ##
## OAuth configured. Without them, only userless guest access is possible.  ##
##############################################################################

# Google client id and secret.
GOOGLE_CLIENT_ID=client_id_here
# Alternatively, can be a path to a file with the client ID
# GOOGLE_CLIENT_ID_FILE=/run/secrets/google-client-id
GOOGLE_CLIENT_SECRET=client_secret_here
# Alternatively, can be a path to a file with the client secret
# GOOGLE_CLIENT_SECRET_FILE=/run/secrets/google-client-secret

# Microsoft client id and secret.
MICROSOFT_CLIENT_ID=client_id_here
# Alternatively, can be a path to a file with the client ID
# MICROSOFT_CLIENT_ID_FILE=/run/secrets/microsoft-client-id
MICROSOFT_CLIENT_SECRET=client_secret_here
# Alternatively, can be a path to a file with the client secret
# MICROSOFT_CLIENT_SECRET_FILE=/run/secrets/microsoft-client-secret

##############
## OPTIONAL ##
##############

# Description of what is hosted on your server
# DESCRIPTION=My organizations Apollo server

# URL (relative or absolute) of the Apollo JBrowse plugin.
# Defaults to relative URL 'apollo.js'
# PLUGIN_LOCATION=apollo.js
# URL (relative or absolute) of a feature ontology JSON file.
# Defaults to relative URL 'sequence_ontology.json'
# FEATURE_TYPE_ONTOLOGY_LOCATION=sequence_ontology.json

# Comma-separated list of attributes in features to treat as ids
# These will be added to feature documents' "indexedIds"
# Defaults to gff_id
# INDEXED_IDS=gff_id,gene_id,transcript_id,exon_id

# Application port, defaults to 3999
# PORT=3999

# Enable all CORS requests, defaults to true
# CORS=true

# Comma-separated list of log levels to output
# Possible values are: error, warn, log, debug, verbose.
# Defaults to error,warn,log
# LOG_LEVELS=error,warn,log

# Reference sequence chunk size, defaults to 262144 (256 KiB)
# CHUNK_SIZE=262144

# Default new user role, possible values are admin, user, readOnly, and none
# Defaults to none
# DEFAULT_NEW_USER_ROLE=none

# Whether to broadcast users locations, defaults to true
# BROADCAST_USER_LOCATION=true

# Whether to allow a root user that can log in with a name and password. All
# other users (besides guest) must sign in with an authentication provider.
# Defaults to false
# ALLOW_ROOT_USER=false
# The root user password, required if ALLOW_ROOT_USER is true
# ROOT_USER_PASSWORD=password
# Alternatively, can be a path to a file with the root user password
# ROOT_USER_PASSWORD_FILE=/run/secrets/root-user-password

# Whether to allow guest users who do not have to log in, defaults to false
# ALLOW_GUEST_USER=false
# If guest users are allowed, what role will they have
# Possible values are admin, readOnly and user; defaults to readonly
# GUEST_USER_ROLE=readOnly

# Comma-separated list of npm package specifiers to load as server plugins.
# Recommended if you control your own server image/build.
# PLUGIN_PACKAGES=my-apollo-server-plugin

# Comma-separated list of URLs to fetch server plugin bundles from at startup,
# with no rebuild required. Bundles must be a Node-targeted ESM/CJS build, not
# a browser/UMD bundle (server-side Apollo plugins have their own, Node-only
# plugin system - see the developer guide). Fetched bundles are cached by
# content hash under PLUGIN_CACHE_DIR (an OS cache dir by default).
# PLUGIN_URLS=https://example.com/my-apollo-server-plugin.mjs
# Alternatively, can be a path to a file with a list of plugin URLs, one URL per
# line
# PLUGIN_URLS_FILE=/data/plugin-urls

# Optional comma-separated list of url=sha256hash pairs, checked against the
# corresponding PLUGIN_URLS entry before it is loaded. If cached, a URL with a
# configured hash skips the network fetch entirely on restart.
# PLUGIN_INTEGRITY=https://example.com/my-apollo-server-plugin.mjs=3f2504e...

# Directory used to cache fetched PLUGIN_URLS bundles by content hash.
# Defaults to an OS-appropriate temp/cache directory.
# PLUGIN_CACHE_DIR=/data/plugin-cache

# HTTP/HTTPS proxy for OAuth requests, if your server is behind a proxy
# OAUTH_HTTP_PROXY=http://proxy.example.com:8080
```

## Restricting assembly access

By default every logged-in user can see and act on every assembly on the server,
subject to their role. To restrict users to particular assemblies, add a
server-side plugin that registers the `Apollo-AssemblyAccess` extension point —
see [Restricting assembly access](../../04-developer-guide/assembly-access.md)
in the developer guide.
