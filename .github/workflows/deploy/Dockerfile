FROM httpd:alpine
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
