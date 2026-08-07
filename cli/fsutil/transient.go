package fsutil

import (
	"errors"
	"io/fs"
	"os"
	"runtime"
	"syscall"
	"time"
)

// TempPrefix names the sibling temp files WriteFileAtomic creates in the destination
// directory. It is exported because callers that sweep a directory need to recognise
// them: they are ours, they are transient, and deleting one mid-write destroys the
// write it belongs to.
const TempPrefix = ".ui-craft-tmp-"

// retryTransient runs op, retrying briefly on Windows when the failure is another
// process holding a handle to the file.
//
// On POSIX a file can be renamed or unlinked while open, so this never applies. Windows
// refuses both, and the process holding the handle is routinely not ours — Defender scans
// every newly created file, Search indexes it, and a backup client may too. The handle is
// released in milliseconds, so the operation that failed succeeds on a second attempt.
//
// This is not a race in our code that a retry papers over. There is no ordering we can
// choose that keeps a virus scanner from opening a file we just wrote; the platform's own
// guidance for this class of error is to retry. Without it, `ui-craft install` fails on
// Windows for a reason the user cannot act on and cannot reproduce reliably.
func retryTransient(op func() error) error {
	err := op()
	if runtime.GOOS != "windows" || err == nil || !isTransientLock(err) {
		return err
	}
	// ~350ms total. Long enough for a scanner to let go, short enough that a genuine
	// permission problem still reports promptly rather than appearing to hang.
	for _, wait := range []time.Duration{10, 25, 50, 100, 150} {
		time.Sleep(wait * time.Millisecond)
		if err = op(); err == nil || !isTransientLock(err) {
			return err
		}
	}
	return err
}

// Windows error codes for "someone else holds this file open".
const (
	errSharingViolation syscall.Errno = 32
	errLockViolation    syscall.Errno = 33
)

// isTransientLock reports whether err is Windows refusing an operation because a handle
// is open elsewhere: ERROR_SHARING_VIOLATION, ERROR_LOCK_VIOLATION, or the ACCESS_DENIED
// a delete-pending file reports. Only meaningful on Windows — the numeric codes collide
// with unrelated POSIX errnos, so callers must gate on GOOS first.
func isTransientLock(err error) bool {
	if errors.Is(err, fs.ErrPermission) {
		return true
	}
	var errno syscall.Errno
	return errors.As(err, &errno) && (errno == errSharingViolation || errno == errLockViolation)
}

// renameRetry and removeRetry wrap the two operations that fail this way. Creating and
// writing a file does not: only renaming over and deleting need the handle to be free.
func renameRetry(oldpath, newpath string) error {
	return retryTransient(func() error { return os.Rename(oldpath, newpath) })
}

func removeRetry(name string) error {
	return retryTransient(func() error {
		err := os.Remove(name)
		if errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		return err
	})
}
