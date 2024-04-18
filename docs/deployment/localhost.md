## Deployment on local machine for single users

This is a quick guide for users willing to install Apollo on their local
machine and with the intention of being the only user. This installation
requires docker, for further details see the [full installation
guide](deployment.md).

```
mkdir -p apollo # Or any directory name of your choice
cd apollo

## MEMO TO DEVS: Edit URL once branch is merged

curl -O https://github.com/GMOD/Apollo3/tree/deployment_docs_fix_url/docs/deployment/compose.yml
curl -O https://github.com/GMOD/Apollo3/tree/deployment_docs_fix_url/docs/deployment/Dockerfile
curl -O https://github.com/GMOD/Apollo3/tree/deployment_docs_fix_url/docs/deployment/.env
```

Since we deploy on localhost for a single user, we give the *guest* admin
rights:

```
sed -i 's|#* *URL=.*|URL=http://localhost|' .env
sed -i 's|#* *ALLOW_GUEST_USER=.*|ALLOW_GUEST_USER=true|' .env
sed -i 's|#* *GUEST_USER_ROLE=.*|GUEST_USER_ROLE=admin|' .env
```

Start Apollo:

```
docker compose up
```
