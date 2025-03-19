FROM oven/bun:latest AS build

COPY ./src /app/src
COPY ./package.json /app/package.json
COPY ./bun.lock /app/bun.lock
WORKDIR /app
RUN bun install --frozen-lockfile
RUN bun run build

FROM ubuntu:24.04 AS runtime
COPY --from=build /app/sync-server /sync-server
CMD ["/sync-server"]
