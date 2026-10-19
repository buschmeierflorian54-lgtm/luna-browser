package web

/*
void LunaStartUpdates(void);
*/
import "C"

func StartUpdates() { C.LunaStartUpdates() }
