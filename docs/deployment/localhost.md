## Deployment on local machine for single users

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
sed -i'' 's|#* *ROOT_USER_NAME=.*|ROOT_USER_NAME=root|' .env
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
