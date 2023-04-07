#/usr/bin/env bash
docker run \
  --env-file ./apollo.env \
  -p 80:80 \
  -p 3999:3999 \
  --mount source=uploaded-files-volume,target=/data/uploads \
  --mount source=mongodb-volume,target=/data/db \
  allinone
