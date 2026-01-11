# Build stage
FROM golang:1.23-alpine AS builder

# Install templ for code generation
RUN go install github.com/a-h/templ/cmd/templ@v0.3.924

WORKDIR /app

# Copy go module files and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the entire source code
COPY . .

# Build the Go application for linux/amd64
RUN GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /app/main ./cmd/main.go

# Final stage
FROM alpine:latest

WORKDIR /app

# Copy the compiled binary from the builder stage
COPY --from=builder /app/main .

# Copy the entire assets directory, which includes the pre-built output.css
COPY --from=builder /app/assets ./assets

# Expose the application port
EXPOSE 8080

# Set environment variables for production
ARG TRANSCRIPTION_SERVICE_URL
ENV TRANSCRIPTION_SERVICE_URL=${TRANSCRIPTION_SERVICE_URL}

# Run the application
CMD ["./main"]
