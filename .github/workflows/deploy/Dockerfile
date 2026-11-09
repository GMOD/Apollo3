FROM httpd:alpine@sha256:d72968666c0a6961b07036d85fc053bc3cf640583cb1ff8360e1617818f164dc
COPY ./httpd.conf /usr/local/apache2/conf/httpd.conf
COPY ./apollo.js /usr/local/apache2/htdocs/
COPY ./jbrowse-web.zip /usr/local/apache2/htdocs/
ADD --chmod=644 https://github.com/The-Sequence-Ontology/SO-Ontologies/raw/refs/heads/master/Ontology_Files/so.json /usr/local/apache2/htdocs/sequence_ontology.json
WORKDIR /usr/local/apache2/htdocs/
RUN <<EOF
set -o errexit
set -o nounset
set -o pipefail
unzip -o jbrowse-web.zip
rm jbrowse-web.zip
EOF
