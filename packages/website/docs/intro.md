---
sidebar_position: 1
---

# Installation

## Getting Started

This guide will help you get up and running quickly with the Apollo3 using Docker Compose.

### Prerequisites

- You have [Docker](https://docs.docker.com/install/) and [Docker Compose version 2.0 or higher](https://docs.docker.com/compose/install/) working on your machine.

## Get the Compose file & start the containers

Get the Compose file from our repo. If you're using curl, run this command in a new directory:
```
curl https://raw.githubusercontent.com/GMOD/Apollo3/main/.github/workflows/deploy/compose.yml -o compose.yml
```

If you're using wget, run this command in a new directory:
```
wget https://raw.githubusercontent.com/GMOD/Apollo3/main/.github/workflows/deploy/compose.yml
```
Then, run the following command to start Apollo3 backend, frontend (Apollo3 plugin and Jbrowse) and the mongo db in Docker containers:
```
docker compose up -d
```
