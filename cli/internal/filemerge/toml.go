// Adapted from github.com/Gentleman-Programming/gentle-ai (MIT).
// Original: internal/components/filemerge/toml.go
package filemerge

import (
	"fmt"
	"runtime"
	"strings"
)

// UpsertTOMLTableKey upserts a [tableName.keyName] block into a TOML document.
// The entry map provides the key=value pairs written inside the block.
//
// The operation is purely line-based (no go-toml dependency). It:
//  1. Scans for an existing [tableName.keyName] section header.
//  2. If found, replaces the key=value lines in that section up to the next
//     section header or EOF; the rest of the file is untouched.
//  3. If not found, appends a new block at the end of the document.
//
// Gotcha #4: on Windows, file-path values in the entry map containing a single
// backslash are automatically doubled (\\ escaped) so the TOML parser does not
// misinterpret \U, \n, etc. as Unicode/escape sequences.
func UpsertTOMLTableKey(content, tableName, keyName string, entry map[string]any) (string, error) {
	header := fmt.Sprintf("[%s.%s]", tableName, keyName)
	lines := splitLines(content)

	// Build the block lines for our entry.
	blockLines, err := buildTOMLBlock(entry)
	if err != nil {
		return "", err
	}

	// Find the existing section header, if any.
	headerIdx := -1
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == header {
			headerIdx = i
			break
		}
	}

	if headerIdx == -1 {
		// Append new block.
		sep := ""
		if len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) != "" {
			sep = "\n"
		}
		block := header + "\n" + strings.Join(blockLines, "\n") + "\n"
		if content == "" {
			return block, nil
		}
		// Ensure trailing newline before appending.
		if !strings.HasSuffix(content, "\n") {
			content += "\n"
		}
		return content + sep + block, nil
	}

	// Replace the existing block: keep lines before the header, write new
	// header + values, then continue from the next section header (or EOF).
	endIdx := headerIdx + 1
	for endIdx < len(lines) {
		t := strings.TrimSpace(lines[endIdx])
		if strings.HasPrefix(t, "[") && !strings.HasPrefix(t, "[[") {
			break
		}
		endIdx++
	}

	var result []string
	result = append(result, lines[:headerIdx]...)
	result = append(result, header)
	result = append(result, blockLines...)
	result = append(result, lines[endIdx:]...)
	out := strings.Join(result, "\n")
	// Ensure a trailing newline for consistency with the append path.
	if !strings.HasSuffix(out, "\n") {
		out += "\n"
	}
	return out, nil
}

// buildTOMLBlock serialises an entry map into TOML key = value lines.
// Supported value types: string, []string, int, int64, float64, bool.
// String values are quoted; arrays of strings are rendered as TOML arrays.
// On Windows, path strings (containing \) have each backslash doubled.
func buildTOMLBlock(entry map[string]any) ([]string, error) {
	// Preserve canonical order: command before args, then the rest alphabetically.
	keys := canonicalKeyOrder(entry)
	var lines []string
	for _, k := range keys {
		v := entry[k]
		line, err := tomlValue(k, v)
		if err != nil {
			return nil, err
		}
		lines = append(lines, line)
	}
	return lines, nil
}

// canonicalKeyOrder returns keys in a stable order: "command" first, "args"
// second, remaining keys in lexicographic order.
func canonicalKeyOrder(entry map[string]any) []string {
	priority := map[string]int{"command": 0, "args": 1}
	var keys []string
	for k := range entry {
		keys = append(keys, k)
	}
	// Stable sort using priority then lexicographic.
	for i := 0; i < len(keys); i++ {
		for j := i + 1; j < len(keys); j++ {
			pi, iHas := priority[keys[i]]
			pj, jHas := priority[keys[j]]
			switch {
			case iHas && jHas:
				if pi > pj {
					keys[i], keys[j] = keys[j], keys[i]
				}
			case !iHas && jHas:
				keys[i], keys[j] = keys[j], keys[i]
			case iHas && !jHas:
				// already in order
			default:
				if keys[i] > keys[j] {
					keys[i], keys[j] = keys[j], keys[i]
				}
			}
		}
	}
	return keys
}

func tomlValue(key string, v any) (string, error) {
	switch val := v.(type) {
	case string:
		escaped := escapeTOMLString(val)
		return fmt.Sprintf("%s = %q", key, escaped), nil
	case []string:
		var parts []string
		for _, s := range val {
			parts = append(parts, fmt.Sprintf("%q", escapeTOMLString(s)))
		}
		return fmt.Sprintf("%s = [%s]", key, strings.Join(parts, ", ")), nil
	case []any:
		var parts []string
		for _, item := range val {
			s, ok := item.(string)
			if !ok {
				return "", fmt.Errorf("filemerge: TOML array element must be string, got %T", item)
			}
			parts = append(parts, fmt.Sprintf("%q", escapeTOMLString(s)))
		}
		return fmt.Sprintf("%s = [%s]", key, strings.Join(parts, ", ")), nil
	case int:
		return fmt.Sprintf("%s = %d", key, val), nil
	case int64:
		return fmt.Sprintf("%s = %d", key, val), nil
	case float64:
		return fmt.Sprintf("%s = %g", key, val), nil
	case bool:
		if val {
			return fmt.Sprintf("%s = true", key), nil
		}
		return fmt.Sprintf("%s = false", key), nil
	default:
		return "", fmt.Errorf("filemerge: unsupported TOML value type %T for key %q", v, key)
	}
}

// escapeTOMLString applies gotcha #4: on Windows, single backslashes in path
// strings must be doubled so TOML parsers don't interpret \U, \n, etc.
// On non-Windows systems the string is returned unchanged.
func escapeTOMLString(s string) string {
	if runtime.GOOS != "windows" {
		return s
	}
	// Only double backslashes that are not already doubled.
	return strings.ReplaceAll(s, `\`, `\\`)
}

// splitLines splits a string into lines. Unlike strings.Split, it treats a
// trailing newline as not introducing an extra empty element.
func splitLines(s string) []string {
	if s == "" {
		return nil
	}
	lines := strings.Split(s, "\n")
	// Remove a spurious trailing empty element caused by a trailing newline.
	if len(lines) > 0 && lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1]
	}
	return lines
}
