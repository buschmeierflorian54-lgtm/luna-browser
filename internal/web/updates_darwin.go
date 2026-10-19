package web

/*
#include <stdlib.h>
void LunaStartUpdates(void);
void LunaCheckUpdates(void);
void LunaSetAutomaticUpdates(int enabled);
char *LunaUpdateStatus(void);
*/
import "C"
import (
	"encoding/json"
	"unsafe"
)

func StartUpdates() { C.LunaStartUpdates() }
func CheckUpdates() { C.LunaCheckUpdates() }
func SetAutomaticUpdates(enabled bool) {
	var value C.int
	if enabled {
		value = 1
	}
	C.LunaSetAutomaticUpdates(value)
}
func UpdateStatus() map[string]any {
	raw := C.LunaUpdateStatus()
	defer C.free(unsafe.Pointer(raw))
	result := map[string]any{}
	_ = json.Unmarshal([]byte(C.GoString(raw)), &result)
	return result
}
