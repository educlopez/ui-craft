BINARY   := ui-craft
VERSION  ?= dev
LDFLAGS  := -X main.version=$(VERSION)

.PHONY: build test lint clean

## build: compile the binary for the current OS/arch (development build).
build:
	go build -ldflags "$(LDFLAGS)" -o $(BINARY) .

## test: run all unit tests with race detector.
test:
	go test -race ./...

## lint: run golangci-lint (must be installed: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest).
lint:
	golangci-lint run ./...

## clean: remove build artifacts.
clean:
	rm -f $(BINARY)
