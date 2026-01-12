# Combined Dockerfile for single-container deployment (Render, Railway, etc.)

# Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Build backend
FROM golang:1.21-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/takedat ./cmd/server

# Final image
FROM alpine:latest
RUN apk --no-cache add ca-certificates

WORKDIR /app
COPY --from=backend-builder /app/takedat .
COPY --from=frontend-builder /app/dist ./static

ENV PORT=8080
ENV STATIC_DIR=/app/static
EXPOSE 8080

CMD ["./takedat"]
