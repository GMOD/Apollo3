# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e

FROM httpd:alpine@sha256:d72968666c0a6961b07036d85fc053bc3cf640583cb1ff8360e1617818f164dc
COPY ./httpd.conf /usr/local/apache2/conf/httpd.conf
COPY ./apollo.js /usr/local/apache2/htdocs/
# Pinned to a commit so builds are reproducible. To update, point at a newer
# commit and replace the checksum.
ADD --chmod=644 --checksum=sha256:164d56c02cddac52240ec84bbbd9d31fa761e9746e32528560f58ce95c16f478 https://github.com/The-Sequence-Ontology/SO-Ontologies/raw/4340c143bac3578bba0c013d02e8c5f0e51ad14a/Ontology_Files/so.json /usr/local/apache2/htdocs/sequence_ontology.json
WORKDIR /usr/local/apache2/htdocs/
# Bind-mount the zip so it isn't stored in a layer of the image
RUN --mount=type=bind,source=jbrowse-web.zip,target=/tmp/jbrowse-web.zip <<EOF
set -o errexit
set -o nounset
set -o pipefail
unzip -o /tmp/jbrowse-web.zip
EOF
