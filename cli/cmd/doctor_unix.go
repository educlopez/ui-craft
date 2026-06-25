//go:build !windows

package cmd

import "syscall"

// diskAvail returns the number of bytes available to unprivileged users at
// the given path using syscall.Statfs (Linux / Darwin).
func diskAvail(path string) (uint64, error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return 0, err
	}
	return uint64(stat.Bsize) * stat.Bavail, nil
}
