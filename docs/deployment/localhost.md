<!-- vim-markdown-toc GFM -->

* [Deployment on local machine for single users](#deployment-on-local-machine-for-single-users)
    * [Full installation including the collaboration server](#full-installation-including-the-collaboration-server)
    * [Installation using JBrowse Desktop](#installation-using-jbrowse-desktop)
        * [Download and start Apollo plugin](#download-and-start-apollo-plugin)
        * [Download and start JBrowse Desktop](#download-and-start-jbrowse-desktop)
        * [Load Apollo plugin](#load-apollo-plugin)

<!-- vim-markdown-toc -->

# Deployment on local machine for single users

## Full installation including the collaboration server

This is a quick guide for users willing to install Apollo on their local
machine and with the intention of being the only user. This installation
requires docker, for further details see the [full installation
guide](deployment.md).

```
mkdir -p apollo # Or any directory of your choice
cd apollo

## MEMO: Edit URL once branch is merged

curl -O https://raw.githubusercontent.com/GMOD/Apollo3/deployment_docs_fix_url/docs/deployment/compose.yml
curl -O https://raw.githubusercontent.com/GMOD/Apollo3/deployment_docs_fix_url/docs/deployment/Dockerfile
curl -O https://raw.githubusercontent.com/GMOD/Apollo3/deployment_docs_fix_url/docs/deployment/.env
```

Since we deploy on localhost for a single user, we give the *guest* user full
permission (NB: the `sed` commands edit the target files *in place*):

```
sed -i'' 's|#* *GUEST_USER_ROLE=.*|GUEST_USER_ROLE=admin|' .env

# Allow root user and set its username and password
sed -i'' 's|#* *ALLOW_ROOT_USER=.*|ALLOW_ROOT_USER=true|' .env
sed -i'' 's|#* *ROOT_USER_NAME=.*|ROOT_USER_NAME=admin|' .env
sed -i'' 's|#* *ROOT_USER_PASSWORD=.*|ROOT_USER_PASSWORD=pass|' .env

sed -i'' 's| ALLOW_GUEST_USER:.*| ALLOW_GUEST_USER: true|' compose.yml
sed -i'' 's| URL: .*| URL: http://localhost|' compose.yml
```

Start Apollo:

```
docker compose up
```

Open a web browser, navigate to [localhost](http://localhost), start a new
session, and login as guest. You may need to refresh the page for the full list
of options to appear under the Apollo menu.

## Installation using JBrowse Desktop

### Download and start Apollo plugin

```
git clone https://github.com/GMOD/Apollo3
cd Apollo3/packages/jbrowse-plugin-apollo 
yarn
yarn build
yarn start
```

### Download and start JBrowse Desktop

To run the latest code of JBrowse:

```
git clone https://github.com/GMOD/jbrowse-components
cd jbrowse-components
yarn
```

The in one terminal window:

```
cd products/jbrowse-desktop
yarn start
```

and in another terminal window (still in `products/jbrowse-desktop`):

```
yarn electron
```

This last may give an error window which you close and continue (close only
that window not the all JBrowse application)

### Load Apollo plugin

In JBrowse:

* Select one of the available genomes just for starting jbrowse, e.g. hg19 then `GO`. 

* Then: `TOOLS -> Plugin store -> ADD CUSTOM PLUGIN`, give a name to *Plugin
name*, e.g. Apollo, and in *Plugin URL* use
`http://localhost:9000/dist/jbrowse-plugin-apollo.umd.development.js`

The menu APOLLO should be active now and you can load a local GFF file. Gff files must include the fasta sequence of the respective genome. If you have gff (`features.gff`) and genome (`genome.fasta`) as separate files concatenate them with, e.g.:

```
cp features.gff features.fasta.gff
echo '## FASTA' >> features.fasta.gff
cat genome.fasta >> features.fasta.gff
```
