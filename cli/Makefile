BINARY   := ui-craft
VERSION  ?= dev
LDFLAGS  := -X main.version=$(VERSION)

.PHONY: build test lint clean gen-mirrors ci-build check-agent-copies

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

## gen-mirrors: run sync-harnesses.mjs and copy output into assets/mirrors/.
## This MUST be run before `make build` in CI (gotcha #5: CI ordering).
## Requires Node.js; output is gitignored — do NOT commit generated mirrors.
gen-mirrors:
	@echo "==> Running sync-harnesses.mjs..."
	cd .. && npm ci --ignore-scripts && node scripts/sync-harnesses.mjs
	@echo "==> Copying mirrors into assets/mirrors/..."
	@for harness in claude cursor codex gemini opencode; do \
		src_dir=""; \
		case "$$harness" in \
			claude)   src_dir="../.claude/skills"   ;; \
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
	@echo "==> gen-mirrors complete."

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

## ci-build: full CI build: gen-mirrors then build binary.
## Step order is enforced to satisfy gotcha #5 (mirror freshness).
ci-build: gen-mirrors build
