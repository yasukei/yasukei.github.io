# Docker

Common `docker` CLI commands for day-to-day container work.

## 1. Images

Pulling, building, and managing images.

```bash
# Download an image from a registry (Docker Hub by default)
docker pull <image>:<tag>

# Build an image from a Dockerfile in the current directory
docker build -t <image>:<tag> .

# List all local images
docker images

# Remove a local image
docker rmi <image>:<tag>

# Remove all unused (dangling) images
docker image prune

# Show the layer history of an image
docker history <image>:<tag>

# Tag an image (e.g. before pushing to a registry)
docker tag <image>:<tag> <registry>/<image>:<tag>

# Push an image to a registry
docker push <registry>/<image>:<tag>
```

---

## 2. Running Containers

```bash
# Run a container in the foreground
docker run <image>:<tag>

# Run a container in the background (detached) and name it
docker run -d --name <container-name> <image>:<tag>

# Publish a container port to the host (host:container)
docker run -d -p 8080:80 <image>:<tag>

# Mount a host directory into the container
docker run -d -v /host/path:/container/path <image>:<tag>

# Mount a named volume into the container
docker run -d -v <volume-name>:/container/path <image>:<tag>

# Set an environment variable
docker run -d -e KEY=value <image>:<tag>

# Run interactively with a pseudo-TTY (e.g. to poke around a shell)
docker run -it <image>:<tag> /bin/bash

# Remove the container automatically once it exits
docker run --rm <image>:<tag>
```

---

## 3. Managing Containers

```bash
# List running containers
docker ps

# List all containers, including stopped ones
docker ps -a

# Start a stopped container
docker start <container>

# Stop a running container gracefully
docker stop <container>

# Force kill a running container
docker kill <container>

# Restart a container
docker restart <container>

# Remove a stopped container
docker rm <container>

# Force remove a running container
docker rm -f <container>

# Remove all stopped containers
docker container prune
```

---

## 4. Inspecting & Debugging

```bash
# Follow the logs of a container
docker logs -f <container>

# Show only the last N lines of logs
docker logs --tail 100 <container>

# Open an interactive shell inside a running container
docker exec -it <container> /bin/bash

# Run a single command inside a running container
docker exec <container> <command>

# Show low-level details (JSON) about a container or image
docker inspect <container>

# Show live resource usage (CPU, memory, network) for running containers
docker stats

# Show running processes inside a container
docker top <container>

# Copy files between a container and the local filesystem
docker cp <container>:/path/in/container ./local/path
docker cp ./local/path <container>:/path/in/container
```

---

## 5. Volumes

Persisting data outside a container's lifecycle.

```bash
# List all volumes
docker volume ls

# Create a named volume
docker volume create <volume-name>

# Show details about a volume (e.g. its mount point on the host)
docker volume inspect <volume-name>

# Remove a volume
docker volume rm <volume-name>

# Remove all unused volumes
docker volume prune
```

---

## 6. Networks

```bash
# List all networks
docker network ls

# Create a custom bridge network
docker network create <network-name>

# Connect a running container to a network
docker network connect <network-name> <container>

# Disconnect a container from a network
docker network disconnect <network-name> <container>

# Show details about a network (connected containers, subnet, etc.)
docker network inspect <network-name>

# Remove all unused networks
docker network prune
```

---

## 7. Docker Compose

Managing multi-container applications defined in `docker-compose.yml`.

```bash
# Create and start all services in the background
docker compose up -d

# Rebuild images before starting
docker compose up -d --build

# Stop and remove containers, networks created by `up`
docker compose down

# Also remove named volumes when tearing down
docker compose down -v

# List the status of services
docker compose ps

# Follow logs for all (or one) service
docker compose logs -f [service]

# Run a one-off command in a service
docker compose exec <service> <command>

# Restart a specific service
docker compose restart <service>
```

---

## 8. Cleanup

Reclaiming disk space.

```bash
# Remove all stopped containers, unused networks, dangling images, and build cache
docker system prune

# Also remove unused volumes and all unused images (not just dangling ones)
docker system prune -a --volumes

# Show disk usage broken down by images, containers, volumes, and cache
docker system df
```

> ⚠️ **Warning:** `prune -a --volumes` is destructive — it deletes anything not currently referenced by a running container, including volumes that may hold data you want to keep. Review `docker system df` first.

---

## 9. Context & Info

```bash
# Show Docker version (client and server)
docker version

# Show system-wide information (storage driver, root dir, etc.)
docker info

# List Docker contexts (useful for switching between local/remote daemons)
docker context ls

# Switch the active context
docker context use <context-name>
```
