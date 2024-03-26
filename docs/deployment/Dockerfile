FROM httpd:alpine
ARG JBROWSE_VERSION
ARG APOLLO_VERSION
ARG FORWARD_HOSTNAME
ARG FORWARD_PORT
COPY <<EOF /usr/local/apache2/conf/httpd.conf.append
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
LoadModule rewrite_module modules/mod_rewrite.so

<VirtualHost *:80>
    RewriteEngine on

    RewriteCond %{DOCUMENT_ROOT}/\$1 !-f
    RewriteCond %{DOCUMENT_ROOT}/\$1 !-d
    RewriteRule ^/(.*)$ http://${FORWARD_HOSTNAME}:${FORWARD_PORT}/\$1 [P,QSA]
    ProxyPassReverse / http://${FORWARD_HOSTNAME}:${FORWARD_PORT}/
</VirtualHost>
EOF
COPY <<EOF /usr/local/apache2/htdocs/config.json
{
  "configuration": {
    "theme": {
      "palette": {
        "primary": {
          "main": "#24264a"
        },
        "secondary": {
          "main": "#6f8fa2"
        },
        "tertiary": {
          "main": "#1e4b34"
        },
        "quaternary": {
          "main": "#6b4e2b"
        }
      }
    }
  },
  "plugins": [
    {
      "name": "Apollo",
      "url": "/jbrowse-plugin-apollo.umd.production.min.js"
    }
  ],
  "internetAccounts": [
    {
      "type": "ApolloInternetAccount",
      "internetAccountId": "apolloInternetAccount",
      "name": "My Apollo Server",
      "description": "A server for my annotations",
      "domains": [
        "${FORWARD_HOSTNAME}"
      ],
      "baseURL": "${FORWARD_HOSTNAME}"
    }
  ]
}
EOF
WORKDIR /usr/local/apache2/htdocs/
RUN <<EOF
set -o errexit
set -o nounset
set -o pipefail
cat /usr/local/apache2/conf/httpd.conf.append >> /usr/local/apache2/conf/httpd.conf
wget https://github.com/GMOD/jbrowse-components/releases/download/v$JBROWSE_VERSION/jbrowse-web-v$JBROWSE_VERSION.zip
unzip -o jbrowse-web-v$JBROWSE_VERSION.zip
rm jbrowse-web-v$JBROWSE_VERSION.zip
wget --output-document=- --quiet https://registry.npmjs.org/@apollo-annotation/jbrowse-plugin-apollo/-/jbrowse-plugin-apollo-$APOLLO_VERSION.tgz | \
  tar --extract --gzip --file=- --strip=2 package/dist/jbrowse-plugin-apollo.umd.production.min.js
EOF
