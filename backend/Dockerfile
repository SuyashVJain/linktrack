# Build context is the repository root (see docker-compose.yml).
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.24-alpine AS api
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /server .

FROM alpine:3.20
RUN adduser -D -u 10001 app
COPY --from=api /server /server
COPY --from=web /web/dist /static
ENV STATIC_DIR=/static
USER app
EXPOSE 8080
CMD ["/server"]
