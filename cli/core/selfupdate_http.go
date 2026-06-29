package core

// selfupdate_http.go — default HTTP implementations for the injectable
// dependencies in SelfUpdateOpts.  Separated to keep the main selfupdate.go
// free of net/http imports (which would pull in that dependency even for
// builds that never call RunSelfUpdate).

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const selfUpdateHTTPTimeout = 30 * time.Second

func selfUpdateFetchReleaseHTTP(url string) (*SelfUpdateRelease, error) {
	client := &http.Client{Timeout: selfUpdateHTTPTimeout}
	resp, err := client.Get(url) //nolint:noctx
	if err != nil {
		return nil, fmt.Errorf("self-update: fetch release: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("self-update: GitHub API returned %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	if err != nil {
		return nil, fmt.Errorf("self-update: read release body: %w", err)
	}
	var rel SelfUpdateRelease
	if err := json.Unmarshal(body, &rel); err != nil {
		return nil, fmt.Errorf("self-update: parse release JSON: %w", err)
	}
	return &rel, nil
}

func selfUpdateDownloadAssetHTTP(url string) ([]byte, error) {
	client := &http.Client{Timeout: selfUpdateHTTPTimeout}
	resp, err := client.Get(url) //nolint:noctx
	if err != nil {
		return nil, fmt.Errorf("self-update: download: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("self-update: download returned %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 256*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("self-update: read download body: %w", err)
	}
	return data, nil
}
