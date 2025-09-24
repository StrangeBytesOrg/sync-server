# Cybermuse Local Sync Server
Syncing for Cybermuse clients

## Running Locally
### Pre-built Binaries
Pre-built binaries are available on [Github](https://github.com/StrangeBytesOrg/sync-server/releases)

The binary will load automatically use a `.env` in the current directory.

```shell
PASSWORD=my-secure-password ./sync-server
```

### Configuration
The server can be configured using environment variables:

- `PASSWORD`: Authentication password for API access (required)
- `DATA_DIR`: Directory for storing sync data (default: `./`)
- `PORT`: Server port (default: `31700`)
- `MAX_UPLOAD_SIZE`: Maximum size for uploaded documents in megabytes (default: 10)

### Run with Docker

```shell
docker run \
-p 31700:31700 \
-v ./sync-data:/data \
-e DATA_DIR=/data \
-e PASSWORD=my-secure-password \
-e MAX_UPLOAD_SIZE=10485760 \
ghcr.io/strangebytesorg/sync-server:latest
```

or use the included [compose.yml](./compose.yml) file
