package filemerge

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
)

// ErrNotJSONObject is returned by the ordered helpers when the input is not a
// single, valid JSON object. Callers must treat it as "refuse to write": the
// file belongs to someone else and a lossy rewrite would destroy it.
var ErrNotJSONObject = errors.New("filemerge: not a valid JSON object")

// member is one key/value pair of a JSON object, with the value kept as the
// exact bytes found in the source so nothing outside the touched key is
// re-encoded.
type member struct {
	key string
	raw json.RawMessage
}

// decodeOrderedObject parses data as a single JSON object and returns its
// members in source order. Empty or whitespace-only input is an empty object.
func decodeOrderedObject(data []byte) ([]member, error) {
	if len(bytes.TrimSpace(data)) == 0 {
		return nil, nil
	}
	dec := json.NewDecoder(bytes.NewReader(data))
	tok, err := dec.Token()
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrNotJSONObject, err)
	}
	if d, ok := tok.(json.Delim); !ok || d != '{' {
		return nil, fmt.Errorf("%w: top-level value is not an object", ErrNotJSONObject)
	}
	var members []member
	for dec.More() {
		keyTok, err := dec.Token()
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrNotJSONObject, err)
		}
		key, ok := keyTok.(string)
		if !ok {
			return nil, fmt.Errorf("%w: object key is not a string", ErrNotJSONObject)
		}
		var raw json.RawMessage
		if err := dec.Decode(&raw); err != nil {
			return nil, fmt.Errorf("%w: %v", ErrNotJSONObject, err)
		}
		members = append(members, member{key: key, raw: raw})
	}
	if _, err := dec.Token(); err != nil { // closing '}'
		return nil, fmt.Errorf("%w: %v", ErrNotJSONObject, err)
	}
	if _, err := dec.Token(); !errors.Is(err, io.EOF) {
		return nil, fmt.Errorf("%w: trailing data after the object", ErrNotJSONObject)
	}
	return members, nil
}

// encodeOrderedObject writes members back as a compact JSON object.
func encodeOrderedObject(members []member) ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteByte('{')
	for i, m := range members {
		if i > 0 {
			buf.WriteByte(',')
		}
		key, err := marshalNoEscape(m.key)
		if err != nil {
			return nil, err
		}
		buf.Write(key)
		buf.WriteByte(':')
		buf.Write(m.raw)
	}
	buf.WriteByte('}')
	return buf.Bytes(), nil
}

// marshalNoEscape marshals v without HTML-escaping <, > and &, so values that
// Node's JSON.stringify wrote stay byte-identical after a round trip.
func marshalNoEscape(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimRight(buf.Bytes(), "\n"), nil
}

// finishOrdered indents the compact object with two spaces (the layout
// JSON.stringify(x, null, 2) and most editors produce) and keeps the source's
// trailing-newline convention. A brand-new file gets a trailing newline.
func finishOrdered(compact []byte, src []byte) ([]byte, error) {
	var out bytes.Buffer
	if err := json.Indent(&out, compact, "", "  "); err != nil {
		return nil, fmt.Errorf("filemerge: indent: %w", err)
	}
	if len(bytes.TrimSpace(src)) == 0 || bytes.HasSuffix(src, []byte("\n")) {
		out.WriteByte('\n')
	}
	return out.Bytes(), nil
}

func indexOf(members []member, key string) int {
	for i, m := range members {
		if m.key == key {
			return i
		}
	}
	return -1
}

// equalJSON reports whether two raw JSON values are equal once insignificant
// whitespace is removed.
func equalJSON(a, b []byte) bool {
	var ca, cb bytes.Buffer
	if json.Compact(&ca, a) != nil || json.Compact(&cb, b) != nil {
		return false
	}
	return bytes.Equal(ca.Bytes(), cb.Bytes())
}

// UpsertOrderedJSONKey sets root[parentKey][key] = value in src and returns
// the new file bytes. It is built for config files owned by another program
// (for example ~/.claude.json, which Claude Code rewrites constantly):
//
//   - every other key, at every level, keeps its value bytes and its position;
//   - an existing entry for key is replaced in place, a new one is appended;
//   - a missing parentKey object is appended to the root;
//   - src that is not a single JSON object, or a parentKey that holds a
//     non-object, returns ErrNotJSONObject and no bytes: never a partial write.
//
// changed is false when root[parentKey][key] already equals value, in which
// case src is returned untouched so the caller can skip the write entirely.
func UpsertOrderedJSONKey(src []byte, parentKey, key string, value any) (out []byte, changed bool, err error) {
	root, err := decodeOrderedObject(src)
	if err != nil {
		return nil, false, err
	}
	valueRaw, err := marshalNoEscape(value)
	if err != nil {
		return nil, false, fmt.Errorf("filemerge: marshal value: %w", err)
	}

	pi := indexOf(root, parentKey)
	var parent []member
	if pi >= 0 {
		parent, err = decodeOrderedObject(root[pi].raw)
		if err != nil || bytes.Equal(bytes.TrimSpace(root[pi].raw), []byte("null")) {
			return nil, false, fmt.Errorf("%w: %q is not an object", ErrNotJSONObject, parentKey)
		}
	}

	if ki := indexOf(parent, key); ki >= 0 {
		if equalJSON(parent[ki].raw, valueRaw) {
			return src, false, nil
		}
		parent[ki].raw = valueRaw
	} else {
		parent = append(parent, member{key: key, raw: valueRaw})
	}

	parentRaw, err := encodeOrderedObject(parent)
	if err != nil {
		return nil, false, err
	}
	if pi >= 0 {
		root[pi].raw = parentRaw
	} else {
		root = append(root, member{key: parentKey, raw: parentRaw})
	}
	compact, err := encodeOrderedObject(root)
	if err != nil {
		return nil, false, err
	}
	out, err = finishOrdered(compact, src)
	if err != nil {
		return nil, false, err
	}
	return out, true, nil
}

// RemoveOrderedJSONKey deletes root[parentKey][key] (or root[key] when
// parentKey is empty) and returns the new bytes, preserving the order and
// bytes of everything else. The parent object is kept even when it becomes
// empty. removed is false (and src is returned untouched) when the key is
// absent. Invalid JSON returns ErrNotJSONObject: the caller must not write.
func RemoveOrderedJSONKey(src []byte, parentKey, key string) (out []byte, removed bool, err error) {
	root, err := decodeOrderedObject(src)
	if err != nil {
		return nil, false, err
	}
	if parentKey == "" {
		ki := indexOf(root, key)
		if ki < 0 {
			return src, false, nil
		}
		root = append(root[:ki], root[ki+1:]...)
	} else {
		pi := indexOf(root, parentKey)
		if pi < 0 {
			return src, false, nil
		}
		parent, perr := decodeOrderedObject(root[pi].raw)
		if perr != nil {
			// Not an object: our key cannot be inside it.
			return src, false, nil
		}
		ki := indexOf(parent, key)
		if ki < 0 {
			return src, false, nil
		}
		parent = append(parent[:ki], parent[ki+1:]...)
		parentRaw, err := encodeOrderedObject(parent)
		if err != nil {
			return nil, false, err
		}
		root[pi].raw = parentRaw
	}
	compact, err := encodeOrderedObject(root)
	if err != nil {
		return nil, false, err
	}
	out, err = finishOrdered(compact, src)
	if err != nil {
		return nil, false, err
	}
	return out, true, nil
}

// LookupOrderedJSONKey returns the raw bytes of root[parentKey][key] (or
// root[key] when parentKey is empty), or nil when absent or src is invalid.
func LookupOrderedJSONKey(src []byte, parentKey, key string) json.RawMessage {
	root, err := decodeOrderedObject(src)
	if err != nil {
		return nil
	}
	if parentKey != "" {
		pi := indexOf(root, parentKey)
		if pi < 0 {
			return nil
		}
		if root, err = decodeOrderedObject(root[pi].raw); err != nil {
			return nil
		}
	}
	if ki := indexOf(root, key); ki >= 0 {
		return root[ki].raw
	}
	return nil
}
