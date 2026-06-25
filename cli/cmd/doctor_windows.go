//go:build windows

package cmd

import (
	"syscall"
	"unsafe"
)

// diskAvail returns the number of bytes available to the caller at the given
// path on Windows using GetDiskFreeSpaceEx.
func diskAvail(path string) (uint64, error) {
	kernel32, err := syscall.LoadDLL("kernel32.dll")
	if err != nil {
		return 0, err
	}
	proc, err := kernel32.FindProc("GetDiskFreeSpaceExW")
	if err != nil {
		return 0, err
	}
	lpPath, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return 0, err
	}
	var freeBytesAvail, _, _ uint64
	r1, _, callErr := proc.Call(
		uintptr(unsafe.Pointer(lpPath)),
		uintptr(unsafe.Pointer(&freeBytesAvail)),
		uintptr(0),
		uintptr(0),
	)
	if r1 == 0 {
		return 0, callErr
	}
	return freeBytesAvail, nil
}
