---
title: REST API
description: Overview of the Apollo collaboration server's REST API
---

# REST API

The Apollo collaboration server has a REST API. The Apollo JBrowse plugin and
the [Apollo CLI](/docs/multi-user/guides/cli) both use it. You can also use it
to write your own scripts and tools. If the CLI already does what you need, it's
usually easier to use, since it handles logging in and paging for you.

The [endpoint reference](#endpoints) is generated from the server's code, so it
matches the version of Apollo these docs are for. You can also download the
[OpenAPI document](https://github.com/GMOD/Apollo3/blob/main/packages/apollo-collaboration-server/openapi.json)
it's built from to use with other tools, such as client generators.

## Base URL

Endpoint paths are relative to your server's URL, which is the `URL` in its
[configuration](/docs/multi-user/installation/configuration-options). For
example, if `URL` is `https://example.org/apollo`, list assemblies with:

```sh
curl -H "Authorization: Bearer $TOKEN" https://example.org/apollo/assemblies
```

In the endpoint reference, set this URL as `baseUrl` to send test requests to
your server.

## Authentication

Most endpoints need a token in an `Authorization: Bearer <token>` header. Each
endpoint's page lists the role it needs. See [Authentication](authentication.md)
for how to get a token.

## Requests and responses

- Request and response bodies are JSON, except for file uploads and downloads.
  Request bodies can be up to 50 MB.
- IDs are MongoDB ObjectIds, sent as 24-character hexadecimal strings.
- Errors have a JSON body with the HTTP status code and a message, e.g.

  ```json
  { "statusCode": 403, "message": "Forbidden resource", "error": "Forbidden" }
  ```

## Making changes

You don't edit annotations, assemblies, or users by updating them directly.
Instead, submit a change with
[`POST /changes`](reference/changes-controller-create.api.mdx). The server
validates the change, applies it, records it in the change log, and sends it to
the other connected clients so they can update. The change log can be read with
[`GET /changes`](reference/changes-controller-find-all.api.mdx).

The server sends changes to clients over a [Socket.IO](https://socket.io/)
connection, which isn't covered in this reference.

## Endpoints

The endpoints are grouped by what they work with:

- [Authentication](reference/authentication.tag.mdx): log in and get tokens
- [Assemblies](reference/assemblies.tag.mdx),
  [RefSeqs](reference/ref-seqs.tag.mdx), and
  [Sequence](reference/sequence.tag.mdx): genome assemblies, their reference
  sequences, and sequence data
- [Features](reference/features.tag.mdx): annotation features
- [Changes](reference/changes.tag.mdx): submit changes and read the change log
- [Checks](reference/checks.tag.mdx): automated checks on features, such as for
  valid CDSs
- [Files](reference/files.tag.mdx): upload GFF3 and FASTA files to add with a
  change
- [Export](reference/export.tag.mdx): download an assembly's annotations as GFF3
- [Users](reference/users.tag.mdx): user accounts and locations
- [JBrowse](reference/j-browse.tag.mdx): JBrowse configuration from the server
- [Health](reference/health.tag.mdx): server status and version
