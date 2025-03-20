# Cybermuse Local Sync Server
Syncing for Cybermuse clients

## Running Locally
### Pre-built Binaries
Pre-built binaries are available on [Github](https://github.com/StrangeBytesOrg/sync-server/releases)

The binary will load automatically use a `.env` in the current directory.

```shell
PASSWORD=my-secure-password ./sync-server
```

### Run with Docker

```shell
docker run \
-p 31700:31700 \
-v ./sync-data:/data \
-e DATA_DIR=/data \
-e PASSWORD=my-secure-password \
ghcr.io/strangebytesorg/sync-server:latest
```

or use the included [compose.yml](./compose.yml) file
