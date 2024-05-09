FROM httpd:alpine
ARG JBROWSE_VERSION
COPY ./httpd.conf /usr/local/apache2/conf/httpd.conf
COPY ./jbrowse-plugin-apollo.umd.development.js /usr/local/apache2/htdocs/
COPY ./jbrowse-plugin-apollo.umd.production.min.js /usr/local/apache2/htdocs/
WORKDIR /usr/local/apache2/htdocs/
RUN <<EOF
set -o errexit
set -o nounset
set -o pipefail
wget https://github.com/GMOD/jbrowse-components/releases/download/v$JBROWSE_VERSION/jbrowse-web-v$JBROWSE_VERSION.zip
unzip -o jbrowse-web-v$JBROWSE_VERSION.zip
rm jbrowse-web-v$JBROWSE_VERSION.zip
EOF
