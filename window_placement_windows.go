package main

import (
	"context"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/sys/windows"
	"os"
	"sync"
	"unsafe"
)

type screenRect struct{ Left, Top, Right, Bottom int32 }
type monitorDetails struct {
	Size          uint32
	Monitor, Work screenRect
	Flags         uint32
}

var initialWindowPlacement sync.Once
var placementUser32 = windows.NewLazySystemDLL("user32.dll")

func platformWindowSize() (int, int) {
	var work screenRect
	ok, _, _ := placementUser32.NewProc("SystemParametersInfoW").Call(0x30, 0, uintptr(unsafe.Pointer(&work)), 0)
	dpi, _, _ := placementUser32.NewProc("GetDpiForSystem").Call()
	if ok == 0 {
		return 760, 480
	}
	return windowSizeForWorkArea(int(work.Right-work.Left), int(work.Bottom-work.Top), int(dpi))
}

func platformWindowReady(ctx context.Context) {
	initialWindowPlacement.Do(func() {
		// Wails has now created its HWND, so use that monitor and its actual DPI,
		// rather than assuming the primary display or a system-wide scale factor.
		var hwnd uintptr
		callback := windows.NewCallback(func(candidate, _ uintptr) uintptr {
			var pid uint32
			placementUser32.NewProc("GetWindowThreadProcessId").Call(candidate, uintptr(unsafe.Pointer(&pid)))
			if pid != uint32(os.Getpid()) {
				return 1
			}
			var class [128]uint16
			placementUser32.NewProc("GetClassNameW").Call(candidate, uintptr(unsafe.Pointer(&class[0])), 128)
			if windows.UTF16ToString(class[:]) != "wailsWindow" {
				return 1
			}
			hwnd = candidate
			return 0
		})
		placementUser32.NewProc("EnumWindows").Call(callback, 0)
		if hwnd != 0 {
			monitor, _, _ := placementUser32.NewProc("MonitorFromWindow").Call(hwnd, 2)
			info := monitorDetails{}
			info.Size = uint32(unsafe.Sizeof(info))
			ok, _, _ := placementUser32.NewProc("GetMonitorInfoW").Call(monitor, uintptr(unsafe.Pointer(&info)))
			if ok != 0 {
				dpi, _, _ := placementUser32.NewProc("GetDpiForWindow").Call(hwnd)
				w, h := windowSizeForWorkArea(int(info.Work.Right-info.Work.Left), int(info.Work.Bottom-info.Work.Top), int(dpi))
				// An old minimum must not force a small/high-DPI screen off its work area.
				wruntime.WindowSetMinSize(ctx, min(760, w), min(480, h))
				wruntime.WindowSetSize(ctx, w, h)
				wruntime.WindowCenter(ctx)
			}
		}
		wruntime.WindowShow(ctx)
	})
}
