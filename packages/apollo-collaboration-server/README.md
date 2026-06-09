# apollo-collaboration-server

NestJS-based Apollo3 backend API used by the JBrowse Apollo plugin.

## Local development

From the Apollo3 repo root:

```bash
yarn --cwd packages/apollo-shared build
yarn --cwd packages/apollo-collaboration-server start
```

Default local API port is `3999`.

## Auth endpoints used by plugin

- `GET /auth/types`
- `POST /auth/local`
- `POST /auth/guest`

## Health checks

- `GET /health`

## Notes

- Source of truth for stack orchestration and reverse proxy behavior is in
  `../jbrowse-apollo-infra`.
- For integrated local bring-up, prefer infra scripts over ad-hoc startup:
  `../jbrowse-apollo-infra/scripts/dev/start_local_stack.sh`.
