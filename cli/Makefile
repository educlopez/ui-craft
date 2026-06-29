BINARY        := ui-craft
VERSION       ?= dev
LDFLAGS       := -X main.version=$(VERSION)

.PHONY: build test lint clean ci-build check-agent-copies release-local check

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

## check-agent-copies: diff repo-root agents/ against cli/assets/agents/claude/.
## Fails (non-zero) if the committed copies diverge from the canonical sources.
## Run this before committing changes to agents/ or cli/assets/agents/claude/.
check-agent-copies:
	@echo "==> Checking agent copies: agents/ vs cli/assets/agents/claude/..."
	@fail=0; \
	for name in design-reviewer a11y-auditor; do \
		src="../agents/$${name}.md"; \
		dst="assets/agents/claude/$${name}.md"; \
		if [ ! -f "$$src" ]; then \
			echo "  ERROR: source $$src not found"; fail=1; continue; \
		fi; \
		if [ ! -f "$$dst" ]; then \
			echo "  ERROR: copy $$dst not found"; fail=1; continue; \
		fi; \
		if ! diff -q "$$src" "$$dst" > /dev/null 2>&1; then \
			echo "  DRIFT: $$src differs from $$dst"; \
			diff "$$src" "$$dst" || true; \
			fail=1; \
		else \
			echo "  OK: $$name.md matches"; \
		fi; \
	done; \
	if [ $$fail -ne 0 ]; then \
		echo "==> check-agent-copies FAILED: update cli/assets/agents/claude/ to match agents/"; \
		exit 1; \
	fi; \
	echo "==> check-agent-copies passed."

## ci-build: build binary. Mirrors are committed so no gen step is required.
ci-build: build

## release-local: build a snapshot release with goreleaser (no publish, no tag required).
## Requires goreleaser installed: go install github.com/goreleaser/goreleaser/v2@latest
release-local:
	@echo "==> Building snapshot release with goreleaser..."
	cd .. && goreleaser release --snapshot --clean --config .goreleaser.yaml

## check: run build + vet + test + gofmt + check-agent-copies — full local gate.
## This mirrors the CI quality bar. Run before opening a PR.
check:
	@echo "==> go build ./..."
	go build ./...
	@echo "==> go vet ./..."
	go vet ./...
	@echo "==> go test -race ./..."
	go test -race ./...
	@echo "==> gofmt check..."
	@unformatted=$$(gofmt -l .); \
	if [ -n "$$unformatted" ]; then \
		echo "gofmt: the following files need formatting:"; \
		echo "$$unformatted"; \
		exit 1; \
	fi; \
	echo "  gofmt OK"
	@echo "==> check-agent-copies..."
	$(MAKE) check-agent-copies
	@echo "==> All checks passed."
