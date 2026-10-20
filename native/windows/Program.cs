using System.Diagnostics;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Windows.Media.Control;
using Windows.Security.Credentials.UI;
using NAudio.CoreAudioApi;
using NAudio.Wave;

namespace Luna.Windows;

static class Program {
    [STAThread] static void Main(string[] args) {
        ApplicationConfiguration.Initialize();
        Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true });
        Console.SetIn(new StreamReader(Console.OpenStandardInput(), Encoding.UTF8));
        if(args.Length>0&&args[0]=="--self-test"){NativeTests.Run();return;}
        if (args.Length == 0 || !int.TryParse(args[0], out var parent)) return;
        Application.Run(new Host(parent));
    }
}

sealed class Host : Form {
    readonly int parentPID;
    IntPtr parent;
    readonly Dictionary<int, WebView2> tabs = new();
    readonly Dictionary<int, bool> loading = new();
    readonly Dictionary<int, bool> failed = new();
    readonly Dictionary<int, string> gestureIDs = new();
    CoreWebView2Environment? environment;
    string gesture = "", appearance = "system";
    bool gesturesOn = true;
    int active = -1;
    Rectangle frame = new(0,0,800,600);
    WaveOutEvent? penPlayer, soundPlayer;
    WaveStream? penStream, soundStream;
    byte[] penData = Array.Empty<byte>();
    Icon? taskIcon;
    readonly System.Windows.Forms.Timer lifetime = new() { Interval=1000 };
    public Host(int pid, bool test=false) {
        parentPID=pid; FormBorderStyle=FormBorderStyle.None; ShowInTaskbar=false;
        StartPosition=FormStartPosition.Manual; Bounds=new Rectangle(-20000,-20000,1,1);
        Shown += (_,_) => { Hide(); if(!test)_=ReadCommands(); };
        lifetime.Tick += (_,_) => { try { if(Process.GetProcessById(parentPID).HasExited) Close(); } catch { Close(); } };
        lifetime.Start();
    }
    static void Output(object value) { lock(typeof(Program)) Console.WriteLine(JsonSerializer.Serialize(value)); }
    static void Event(object value) => Output(new { @event=value });
    async Task ReadCommands() {
        while(await Console.In.ReadLineAsync() is { } line) {
            long id=0;
            try {
                using var doc=JsonDocument.Parse(line); var root=doc.RootElement;
                id=root.GetProperty("id").GetInt64();
                var result=await Execute(root.GetProperty("op").GetString()!,root.GetProperty("args"));
                Output(new {id,result});
            } catch(Exception e) { Output(new {id,error=e.Message}); }
        }
        Close();
    }
    static int Int(JsonElement a,string key,int d=0)=>a.TryGetProperty(key,out var v)?v.GetInt32():d;
    static string Str(JsonElement a,string key,string d="")=>a.TryGetProperty(key,out var v)?v.GetString()??d:d;
    static bool Bool(JsonElement a,string key)=>a.TryGetProperty(key,out var v)&&v.GetBoolean();
    static double Num(JsonElement a,string key)=>a.GetProperty(key).GetDouble();
    void Attach() {
        if(parent!=IntPtr.Zero) return;
        EnumWindows((hwnd,_)=>{GetWindowThreadProcessId(hwnd,out var pid);if(pid==parentPID&&IsWindowVisible(hwnd)){parent=hwnd;return false;}return true;},IntPtr.Zero);
        if(parent==IntPtr.Zero) throw new InvalidOperationException("Luna-Fenster ist noch nicht bereit.");
        SetParent(Handle,parent);
        SetWindowLongPtr(Handle,-16,new IntPtr(0x40000000L | 0x04000000L | 0x02000000L));
        ApplyFrame();
    }
    void ApplyFrame() {
        if(parent==IntPtr.Zero)return;
        var scale=GetDpiForWindow(parent)/96.0;
        SetWindowPos(Handle,IntPtr.Zero,(int)(frame.X*scale),(int)(frame.Y*scale),Math.Max(1,(int)(frame.Width*scale)),Math.Max(1,(int)(frame.Height*scale)),0x0010);
    }
    const string bridge = "window.webkit={messageHandlers:{fmGesture:{postMessage:m=>window.chrome.webview.postMessage(m)}}};";
    string GestureScript()=>bridge+gesture+";window.__fmGesture="+(gesturesOn?"true":"false")+";";
    async Task<WebView2> Tab(int id) {
        if(tabs.TryGetValue(id,out var existing)) return existing;
        Attach();
        environment ??= await CoreWebView2Environment.CreateAsync(null,Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Luna Browser","WebView2"));
        var view=new WebView2 {Dock=DockStyle.Fill,Visible=false};
        Controls.Add(view);
        try { await view.EnsureCoreWebView2Async(environment); } catch { Controls.Remove(view);view.Dispose();throw; }
        tabs[id]=view;loading[id]=false;failed[id]=false;
        var core=view.CoreWebView2;
        core.Settings.AreDevToolsEnabled=false;
        core.Settings.IsStatusBarEnabled=false;
        core.Profile.PreferredColorScheme=Scheme();
        gestureIDs[id]=await core.AddScriptToExecuteOnDocumentCreatedAsync(GestureScript());
        core.NavigationStarting+=(_,e)=>{loading[id]=true;failed[id]=false;State(id);};
        core.SourceChanged+=(_,_)=>State(id);
        core.DocumentTitleChanged+=(_,_)=>State(id);
        core.HistoryChanged+=(_,_)=>State(id);
        core.NavigationCompleted+=(_,e)=>{
            loading[id]=false;failed[id]=!e.IsSuccess;State(id);
            Event(new {t="loaded",tab=id,url=core.Source,title=core.DocumentTitle,error=!e.IsSuccess});
            if(!e.IsSuccess) Event(new {t="error",tab=id,url=core.Source,message="Seite konnte nicht geladen werden: "+e.WebErrorStatus});
        };
        core.FaviconChanged+=(_,_)=>Event(new {t="favicon",tab=id,icon=core.FaviconUri});
        core.NewWindowRequested+=async (_,e)=>{
            // Keep window.opener for OAuth popups; the frontend adopts the supplied native tab id.
            var deferral=e.GetDeferral();
            try {var nid=Interlocked.Decrement(ref popupID);var popup=await Tab(nid);e.NewWindow=popup.CoreWebView2;e.Handled=true;Event(new {t="popup",tab=nid,opener=id});}
            finally{deferral.Complete();}
        };
        core.WindowCloseRequested+=(_,_)=>Event(new {t="close",tab=id});
        core.WebMessageReceived+=(_,e)=>{
            try{using var d=JsonDocument.Parse(e.WebMessageAsJson);var m=d.RootElement;var kind=Str(m,"kind");
                if(kind=="draw"){PlayPen(Bool(m,"on"));return;}
                if(kind=="letter"&&gesturesOn&&id==active)Event(new {t="gesture",tab=id,kind="letter",letter=Str(m,"letter")});
            }catch(JsonException){}
        };
        core.DownloadStarting+=(_,e)=>{
            using var dialog=new SaveFileDialog {FileName=Path.GetFileName(e.ResultFilePath),InitialDirectory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),"Downloads")};
            if(dialog.ShowDialog(this)!=DialogResult.OK){e.Cancel=true;return;}
            e.ResultFilePath=dialog.FileName;e.Handled=true;
            var download=e.DownloadOperation;var did=Guid.NewGuid().ToString();
            Event(new {t="dl",id=did,state="start",name=Path.GetFileName(dialog.FileName),path=dialog.FileName,total=download.TotalBytesToReceive??0});
            download.BytesReceivedChanged+=(_,_)=>Event(new {t="dl",id=did,state="progress",received=download.BytesReceived,total=download.TotalBytesToReceive??0});
            download.StateChanged+=(_,_)=>{if(download.State!=CoreWebView2DownloadState.InProgress)Event(new {t="dl",id=did,state=download.State==CoreWebView2DownloadState.Completed?"done":"failed",message=download.InterruptReason.ToString()});};
        };
        core.PermissionRequested+=(_,e)=>{
            // Permissions stay origin-specific and require an explicit choice.
            e.State=MessageBox.Show(this,$"{e.Uri}\n\nZugriff erlauben: {e.PermissionKind}?","Luna – Website-Berechtigung",MessageBoxButtons.YesNo,MessageBoxIcon.Question)==DialogResult.Yes?CoreWebView2PermissionState.Allow:CoreWebView2PermissionState.Deny;
        };
        view.KeyDown+=(_,e)=>{
            var cmd=Shortcut(e.KeyValue,e.Control,e.Shift,e.Alt);
            if(cmd!=null){e.Handled=true;e.SuppressKeyPress=true;Event(new {t="command",name=cmd});}
        };
        return view;
    }
    int popupID=1000000000;
    internal static string? Shortcut(int key,bool ctrl,bool shift,bool alt) {
        if(!ctrl)return null;
        if(alt)return key switch{0x53=>"screenshot",0x4e=>"toggle-notes",0x42=>"show-bookmarks",0x4c=>"show-downloads",0x25=>"prev-tab",0x27=>"next-tab",_=>null};
        if(shift)return key switch{0x44=>"toggle-theme",0x42=>"toggle-bar",_=>null};
        return key switch{0x54=>"new-tab",0x57=>"close-tab",0x4c=>"focus-url",0x46=>"find",0x52=>"reload",0xbc=>"settings",0x44=>"bookmark",0x59=>"show-history",0xbb=>"zoom-in",0xbd=>"zoom-out",0x30=>"zoom-reset",>=0x31 and <=0x39=>"tab-"+(key-0x30),_=>null};
    }
    CoreWebView2PreferredColorScheme Scheme()=>appearance switch{"dark"=>CoreWebView2PreferredColorScheme.Dark,"light"=>CoreWebView2PreferredColorScheme.Light,_=>CoreWebView2PreferredColorScheme.Auto};
    void State(int id){if(!tabs.TryGetValue(id,out var v))return;var c=v.CoreWebView2;Event(new {t="state",tab=id,url=c.Source,title=c.DocumentTitle,loading=loading[id],progress=loading[id]?0.2:1.0,back=c.CanGoBack,fwd=c.CanGoForward});}
    internal async Task<object?> Execute(string op,JsonElement a) {
        int id=a.ValueKind==JsonValueKind.Object?Int(a,"tab",-1):-1;
        WebView2 Existing()=>tabs.TryGetValue(id,out var t)?t:throw new InvalidOperationException("Dieser Tab ist nicht geöffnet.");
        switch(op){
            case "load":
                var url=Str(a,"url");if(!Uri.TryCreate(url,UriKind.Absolute,out var u)||!(u.Scheme=="https"||u.Scheme=="http"||url=="about:blank"))throw new InvalidOperationException("Diese Adresse wird nicht unterstützt.");
                (await Tab(id)).CoreWebView2.Navigate(url);return null;
            case "show":active=id;foreach(var (tid,v) in tabs)v.Visible=tid==id;if(id<0)Hide();else if(tabs.TryGetValue(id,out var shown)){Show();shown.BringToFront();shown.Focus();}return null;
            case "frame":frame=new Rectangle((int)Num(a,"x"),(int)Num(a,"y"),(int)Num(a,"width"),(int)Num(a,"height"));ApplyFrame();return null;
            case "close":if(tabs.Remove(id,out var closed)){Controls.Remove(closed);closed.Dispose();loading.Remove(id);failed.Remove(id);gestureIDs.Remove(id);}return null;
            case "back":if(Existing().CanGoBack)Existing().GoBack();return null;
            case "forward":if(Existing().CanGoForward)Existing().GoForward();return null;
            case "reload":Existing().Reload();return null;
            case "stop":Existing().CoreWebView2.Stop();return null;
            case "zoom":Existing().ZoomFactor=Math.Clamp(Num(a,"factor"),0.25,5);return null;
            case "focus":Attach();SetFocus(parent);return null;
            case "find":var found=await Existing().ExecuteScriptAsync("window.find("+JsonSerializer.Serialize(Str(a,"text"))+",false,"+(!Bool(a,"forward")?"true":"false")+",true)");Event(new{t="find",tab=id,found=found=="true"});return null;
            case "evaluate":var result=await Existing().ExecuteScriptAsync(Str(a,"source"));using(var d=JsonDocument.Parse(result))return d.RootElement.ValueKind==JsonValueKind.String?d.RootElement.GetString():result;
            case "snapshot":case "screenshot":
                using(var stream=new MemoryStream()){
                    if(id>=0)await Existing().CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Jpeg,stream);
                    else {Attach();var point=new Point(frame.X,frame.Y);ClientToScreen(parent,ref point);var scale=GetDpiForWindow(parent)/96.0;point=new Point(point.X+(int)(frame.X*(scale-1)),point.Y+(int)(frame.Y*(scale-1)));using var bitmap=new Bitmap(Math.Max(1,(int)(frame.Width*scale)),Math.Max(1,(int)(frame.Height*scale)));using(var g=Graphics.FromImage(bitmap))g.CopyFromScreen(point,Point.Empty,bitmap.Size);bitmap.Save(stream,ImageFormat.Jpeg);}
                    if(op=="screenshot"){stream.Position=0;using var img=Image.FromStream(stream);Clipboard.SetImage(img);}
                    return Convert.ToBase64String(stream.ToArray());
                }
            case "appearance":appearance=Str(a,"mode");foreach(var v in tabs.Values)v.CoreWebView2.Profile.PreferredColorScheme=Scheme();return null;
            case "gesture":if(Str(a,"source")!="")gesture=Str(a,"source");gesturesOn=Bool(a,"on");foreach(var (tid,v) in tabs){v.CoreWebView2.RemoveScriptToExecuteOnDocumentCreated(gestureIDs[tid]);gestureIDs[tid]=await v.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(GestureScript());await v.ExecuteScriptAsync("window.__fmGesture="+(gesturesOn?"true":"false"));}return null;
            case "writeSoundData":penData=Convert.FromBase64String(Str(a,"data"));return null;
            case "writeSound":PlayPen(Bool(a,"on"));return null;
            case "sound":soundPlayer?.Dispose();soundStream?.Dispose();soundStream=new Mp3FileReader(new MemoryStream(Convert.FromBase64String(Str(a,"data"))));soundPlayer=new WaveOutEvent();soundPlayer.Init(soundStream);soundPlayer.Play();return null;
            case "authenticate":Attach();if(await UserConsentVerifier.CheckAvailabilityAsync()!=UserConsentVerifierAvailability.Available)return "unavailable";var verified=await UserConsentVerifierInterop.RequestVerificationForWindowAsync(parent,Str(a,"reason"));return verified==UserConsentVerificationResult.Verified?"verified":"denied";
            case "clipboard":return ClipboardStatus(id,Str(a,"provider"),Int(a,"previousCount",-1));
            case "volume":using(var enumerator=new MMDeviceEnumerator())using(var device=enumerator.GetDefaultAudioEndpoint(DataFlow.Render,Role.Multimedia))return new{volume=device.AudioEndpointVolume.Mute?0:(int)Math.Round(device.AudioEndpointVolume.MasterVolumeLevelScalar*100),device=device.ID};
            case "spotifyState":return await SpotifyState();
            case "spotifyCommand":return await SpotifyCommand(Str(a,"command"),Num(a,"value"));
            case "icon":Attach();using(var stream=new MemoryStream(Convert.FromBase64String(Str(a,"data"))))using(var bitmap=new Bitmap(stream)){var h=bitmap.GetHicon();try{taskIcon?.Dispose();taskIcon=(Icon)Icon.FromHandle(h).Clone();SendMessage(parent,0x80,new IntPtr(1),taskIcon.Handle);SendMessage(parent,0x80,IntPtr.Zero,taskIcon.Handle);}finally{DestroyIcon(h);}}return true;
            case "palette":return null; // WebView2 renders its own error pages in the selected color scheme.
            default:throw new InvalidOperationException("Unbekannte Windows-Anfrage: "+op);
        }
    }
    void PlayPen(bool on){if(!on){penPlayer?.Stop();return;}if(penData.Length==0)return;if(penPlayer==null){penStream=new Mp3FileReader(new MemoryStream(penData));penPlayer=new WaveOutEvent();penPlayer.Init(new LoopStream(penStream));}penPlayer.Play();}
    object ClipboardStatus(int id,string provider,int previous){
        tabs.TryGetValue(id,out var tab);Uri.TryCreate(tab?.Source?.ToString(),UriKind.Absolute,out var uri);
        var count=GetClipboardSequenceNumber();var eligible=id==active&&Visible&&GetForegroundWindow()==parent&&uri!=null&&!(loading.GetValueOrDefault(id)||failed.GetValueOrDefault(id))&&TrustedKeyPage(uri,provider);
        var text=eligible&&previous>=0&&count!=(uint)previous&&Clipboard.ContainsText()?Clipboard.GetText():null;
        return new{count,eligible,host=uri?.Host??"",loading=loading.GetValueOrDefault(id),error=failed.GetValueOrDefault(id),text=text?.Length<=4096?text:null};
    }
    internal static bool TrustedKeyPage(Uri u,string provider){if(u.Scheme!="https")return false;var p=u.AbsolutePath.TrimEnd('/');return provider switch{"brave"=>u.Host=="api-dashboard.search.brave.com"&&p=="/app/keys","groq"=>u.Host=="console.groq.com"&&p=="/keys","openrouter"=>u.Host=="openrouter.ai"&&(p=="/settings/keys"||(p.StartsWith("/workspace/")&&p.EndsWith("/keys"))),"spotify"=>u.Host=="developer.spotify.com"&&p.StartsWith("/dashboard/"),_=>false};}
    static async Task<GlobalSystemMediaTransportControlsSession?> Spotify(){var manager=await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();return manager.GetSessions().FirstOrDefault(s=>s.SourceAppUserModelId.Contains("Spotify",StringComparison.OrdinalIgnoreCase));}
    static async Task<object> SpotifyState(){var session=await Spotify();if(session==null)return new{status="off"};var media=await session.TryGetMediaPropertiesAsync();var p=session.GetPlaybackInfo();var timeline=session.GetTimelineProperties();var position=timeline.Position;if(p.PlaybackStatus==GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing)position+=DateTimeOffset.UtcNow-timeline.LastUpdatedTime;return new{status=p.PlaybackStatus==GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing?"playing":"paused",title=media.Title,artist=media.Artist,album=media.AlbumTitle,duration=(int)timeline.EndTime.TotalSeconds,position=(int)Math.Clamp(position.TotalSeconds,0,timeline.EndTime.TotalSeconds),shuffle=p.IsShuffleActive??false,repeat=p.AutoRepeatMode!=null&&p.AutoRepeatMode!=Windows.Media.MediaPlaybackAutoRepeatMode.None,volume=SpotifyVolume(null)};}
    static int SpotifyVolume(float? value){using var devices=new MMDeviceEnumerator();using var device=devices.GetDefaultAudioEndpoint(DataFlow.Render,Role.Multimedia);var sessions=device.AudioSessionManager.Sessions;for(int i=0;i<sessions.Count;i++){using var session=sessions[i];try{if(!Process.GetProcessById((int)session.GetProcessID).ProcessName.Equals("Spotify",StringComparison.OrdinalIgnoreCase))continue;if(value.HasValue)session.SimpleAudioVolume.Volume=value.Value;return (int)Math.Round(session.SimpleAudioVolume.Volume*100);}catch(ArgumentException){}}return 0;}
    static async Task<object?> SpotifyCommand(string command,double value){var session=await Spotify()??throw new InvalidOperationException("Spotify öffnen und einen Titel starten.");bool ok;switch(command){case "playpause":ok=await session.TryTogglePlayPauseAsync();break;case "next":ok=await session.TrySkipNextAsync();break;case "previous":ok=await session.TrySkipPreviousAsync();break;case "seek":ok=await session.TryChangePlaybackPositionAsync(TimeSpan.FromSeconds(Math.Max(0,value)).Ticks);break;case "shuffle":ok=await session.TryChangeShuffleActiveAsync(!(session.GetPlaybackInfo().IsShuffleActive??false));break;case "repeat":ok=await session.TryChangeAutoRepeatModeAsync(session.GetPlaybackInfo().AutoRepeatMode==Windows.Media.MediaPlaybackAutoRepeatMode.None?Windows.Media.MediaPlaybackAutoRepeatMode.List:Windows.Media.MediaPlaybackAutoRepeatMode.None);break;case "volume":SpotifyVolume((float)Math.Clamp(value/100,0,1));return null;default:throw new InvalidOperationException("Unbekannter Spotify-Befehl.");}if(!ok)throw new InvalidOperationException("Spotify unterstützt diesen Windows-Medienbefehl nicht.");return null;}
    protected override void Dispose(bool disposing){if(disposing){lifetime.Dispose();penPlayer?.Dispose();penStream?.Dispose();soundPlayer?.Dispose();soundStream?.Dispose();taskIcon?.Dispose();}base.Dispose(disposing);}
    delegate bool EnumCallback(IntPtr hwnd,IntPtr param);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumCallback cb,IntPtr param);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out int pid);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr SetParent(IntPtr child,IntPtr parent);
    [DllImport("user32.dll",EntryPoint="SetWindowLongPtrW")] static extern IntPtr SetWindowLongPtr(IntPtr h,int index,IntPtr value);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
    [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr SetFocus(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetClipboardSequenceNumber();
    [DllImport("user32.dll")] static extern short GetKeyState(int key);
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h,ref Point point);
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h,int msg,IntPtr w,IntPtr l);
    [DllImport("user32.dll")] static extern bool DestroyIcon(IntPtr h);
}
sealed class LoopStream(WaveStream source):WaveStream {
    public override WaveFormat WaveFormat=>source.WaveFormat;
    public override long Length=>source.Length;
    public override long Position{get=>source.Position;set=>source.Position=value;}
    public override int Read(byte[] buffer,int offset,int count){int total=0;while(total<count){var read=source.Read(buffer,offset+total,count-total);if(read==0){if(source.Position==0)break;source.Position=0;}total+=read;}return total;}
}
