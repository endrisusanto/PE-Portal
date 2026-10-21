# Build stage
FROM golang:alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/pe-portal ./cmd/server

# Final stage
FROM alpine:3.19

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/pe-portal /app/pe-portal
COPY --from=builder /app/migrations /app/migrations

RUN mkdir -p /data/files

EXPOSE 8080

CMD ["/app/pe-portal"]
