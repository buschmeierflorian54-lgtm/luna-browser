package macvolume

/*
#cgo LDFLAGS: -framework CoreAudio
#include <CoreAudio/CoreAudio.h>
static int volume(unsigned int *device) {
 AudioObjectPropertyAddress a={kAudioHardwarePropertyDefaultOutputDevice,kAudioObjectPropertyScopeGlobal,kAudioObjectPropertyElementMain};
 UInt32 size=sizeof(AudioDeviceID); AudioDeviceID d=0;
 if(AudioObjectGetPropertyData(kAudioObjectSystemObject,&a,0,NULL,&size,&d)!=noErr) return -1;
 *device=d; a.mSelector=kAudioDevicePropertyVolumeScalar; a.mScope=kAudioDevicePropertyScopeOutput;
 Float32 v=0; size=sizeof(v);
 if(AudioObjectGetPropertyData(d,&a,0,NULL,&size,&v)!=noErr) {
 a.mElement=1; if(AudioObjectGetPropertyData(d,&a,0,NULL,&size,&v)!=noErr) return -1;
 }
 a.mElement=kAudioObjectPropertyElementMain; a.mSelector=kAudioDevicePropertyMute; UInt32 mute=0; size=sizeof(mute);
 if(AudioObjectGetPropertyData(d,&a,0,NULL,&size,&mute)==noErr && mute) return 0;
 return (int)(v*100+0.5);
}
*/
import "C"

func Read() (int, uint32) { var d C.uint; v := C.volume(&d); return int(v), uint32(d) }
