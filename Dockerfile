# Build stage
FROM golang:1.23-alpine AS builder

# 1. Install Node.js and NPM
# This is much more stable on Alpine/ARM64 than the standalone binary
RUN apk add --no-cache nodejs npm

# Install templ
RUN go install github.com/a-h/templ/cmd/templ@v0.3.924

WORKDIR /app

# Copy go module files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# 2. Install Tailwind CSS via NPM
# We install it locally to ensure we get the correct version compatible with your CSS
RUN npm install -D tailwindcss @tailwindcss/cli

# Generate templ files
RUN templ generate

# 3. Generate CSS using npx
# This runs the JS version of Tailwind, avoiding the binary crash
RUN npx tailwindcss -i ./assets/css/input.css -o ./assets/css/output.css --minify

# Build the application
RUN go build -o main cmd/main.go

# Final stage
FROM alpine:latest

WORKDIR /app

# Copy binary and assets
COPY --from=builder /app/main .
COPY --from=builder /app/assets ./assets

# Expose port
EXPOSE 8080

# Run the application
CMD ["./main"]