param([long]$WindowHandle)
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class LunaChrome {
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr hwnd);
 [StructLayout(LayoutKind.Sequential)] public struct Point { public int X, Y; }
 [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hwnd, ref Point point);
 [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hwnd);
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
 [DllImport("user32.dll")] public static extern long GetWindowLongPtrW(IntPtr hwnd, int index);
 [DllImport("user32.dll")] public static extern IntPtr GetMenu(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int command);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
}
'@
Add-Type -AssemblyName System.Windows.Forms
$hwnd = [IntPtr]$WindowHandle
if (![LunaChrome]::IsWindowVisible($hwnd)) { throw 'Initial window never became visible' }
$style = [LunaChrome]::GetWindowLongPtrW($hwnd, -16)
# Keep native resize, system-menu and minimize/maximize capabilities.
# The visible caption buttons are in the trusted WebView tab row.
$required = 0x00CF0000
if (($style -band $required) -ne $required) { throw 'Native caption or window controls missing' }
$origin = New-Object LunaChrome+Point
[LunaChrome]::ClientToScreen($hwnd, [ref]$origin) | Out-Null
$frame = New-Object LunaChrome+Rect
[LunaChrome]::GetWindowRect($hwnd, [ref]$frame) | Out-Null
if (($origin.Y - $frame.Top) -gt 12) { throw 'Extra native title row above tabs' }
if ([LunaChrome]::GetMenu($hwnd) -ne [IntPtr]::Zero) { throw 'Unexpected Windows menu bar' }
$rect = New-Object LunaChrome+Rect
[LunaChrome]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
$area = [System.Windows.Forms.Screen]::FromHandle($hwnd).WorkingArea
if ($rect.Top -lt $area.Top -or $rect.Right -gt $area.Right -or $rect.Left -lt $area.Left -or $rect.Bottom -gt $area.Bottom) { throw "Window controls outside work area: $rect / $area" }
$dpi = [LunaChrome]::GetDpiForWindow($hwnd)
$margin = [Math]::Floor(12 * $dpi / 96)
if ($rect.Top -lt ($area.Top + $margin) -or $rect.Left -lt ($area.Left + $margin) -or $rect.Right -gt ($area.Right - $margin) -or $rect.Bottom -gt ($area.Bottom - $margin)) { throw 'Startup window does not preserve the visible work-area margin' }
[LunaChrome]::ShowWindow($hwnd, 6) | Out-Null
Start-Sleep -Milliseconds 300
if (![LunaChrome]::IsIconic($hwnd)) { throw 'Minimize failed' }
[LunaChrome]::ShowWindow($hwnd, 9) | Out-Null
[LunaChrome]::ShowWindow($hwnd, 3) | Out-Null
Start-Sleep -Milliseconds 300
if (![LunaChrome]::IsZoomed($hwnd)) { throw 'Maximize failed' }
[LunaChrome]::ShowWindow($hwnd, 9) | Out-Null
Write-Output 'WINDOW_CHROME_PASSED'
