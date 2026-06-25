BINARY        := ui-craft
VERSION       ?= dev
MIRROR_VERSION ?= dev
LDFLAGS       := -X main.version=$(VERSION) -X main.mirrorVersion=$(MIRROR_VERSION)

.PHONY: build test lint clean gen-mirrors check-mirrors ci-build check-agent-copies release-local check

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

## gen-mirrors: regenerate harness mirrors from skills/ and commit the result.
## Mirrors are committed directly (gentle-ai model — no gen-before-build).
## After running this target, stage and commit cli/assets/mirrors/ changes.
## Requires Node.js.
gen-mirrors:
	@echo "==> Running sync-harnesses.mjs..."
	cd .. && npm ci --ignore-scripts && node scripts/sync-harnesses.mjs
	@echo "==> Copying mirrors into assets/mirrors/..."
	@for harness in claude cursor codex gemini opencode; do \
		src_dir=""; \
		case "$$harness" in \
			claude)   src_dir="../.agents/skills"   ;; \
			cursor)   src_dir="../.cursor/skills"   ;; \
			codex)    src_dir="../.codex/skills"    ;; \
			gemini)   src_dir="../.gemini/skills"   ;; \
			opencode) src_dir="../.opencode/skills" ;; \
		esac; \
		if [ -d "$$src_dir" ]; then \
			mkdir -p "assets/mirrors/$$harness"; \
			cp -r "$$src_dir/." "assets/mirrors/$$harness/"; \
			echo "  Copied $$src_dir -> assets/mirrors/$$harness"; \
		else \
			echo "  WARNING: $$src_dir not found (skipping $$harness)"; \
		fi; \
	done
	@echo "==> gen-mirrors complete. Stage and commit cli/assets/mirrors/ to persist."

## check-mirrors: verify committed mirrors match current skills/ output.
## Fails (non-zero) if cli/assets/mirrors/ would change after regeneration.
## Run in CI to catch forgotten `make gen-mirrors && git add` before merge.
check-mirrors:
	@echo "==> Checking committed mirrors for drift..."
	@tmpdir=$$(mktemp -d); \
	cd .. && node scripts/sync-harnesses.mjs > /dev/null 2>&1; \
	for harness in claude cursor codex gemini opencode; do \
		src_dir=""; \
		case "$$harness" in \
			claude)   src_dir=".agents/skills"   ;; \
			cursor)   src_dir=".cursor/skills"   ;; \
			codex)    src_dir=".codex/skills"    ;; \
			gemini)   src_dir=".gemini/skills"   ;; \
			opencode) src_dir=".opencode/skills" ;; \
		esac; \
		if [ -d "$$src_dir" ]; then \
			cp -r "$$src_dir" "$$tmpdir/$$harness"; \
		fi; \
	done; \
	cd cli; \
	fail=0; \
	for harness in claude cursor codex gemini opencode; do \
		if [ ! -d "$$tmpdir/$$harness" ]; then continue; fi; \
		if ! diff -r --brief "assets/mirrors/$$harness" "$$tmpdir/$$harness" > /dev/null 2>&1; then \
			echo "  DRIFT: assets/mirrors/$$harness differs from current $$harness skills output"; \
			diff -r "assets/mirrors/$$harness" "$$tmpdir/$$harness" || true; \
			fail=1; \
		else \
			echo "  OK: $$harness mirrors match"; \
		fi; \
	done; \
	rm -rf "$$tmpdir"; \
	if [ $$fail -ne 0 ]; then \
		echo "==> check-mirrors FAILED: run 'make gen-mirrors' and commit cli/assets/mirrors/"; \
		exit 1; \
	fi; \
	echo "==> check-mirrors passed."

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
## Mirrors are committed — no gen-mirrors step needed before build.
release-local:
	@echo "==> Building snapshot release with goreleaser..."
	cd .. && MIRROR_VERSION=$(MIRROR_VERSION) goreleaser release --snapshot --clean --config .goreleaser.yaml

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
