using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
namespace Luna.Windows;
static class NativeTests
{
    public static void Run()
    {
        var parent = new Form { Width = 1000, Height = 700, Text = "Luna Native Tests" };
        parent.Shown += async (_, _) =>
        {
            try { await Test(); Console.WriteLine("NATIVE_TESTS_PASSED"); Environment.ExitCode = 0; }
            catch (Exception e) { Console.Error.WriteLine(e); Environment.ExitCode = 1; }
            finally { parent.Close(); }
        };
        Application.Run(parent);
    }
    static void Assert(bool value, string reason) { if (!value) throw new Exception(reason); }
    static async Task Test()
    {
        var queue = new CommandQueue();
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var order = new List<int>();
        var slow = queue.Enqueue(async () => { await release.Task; order.Add(1); }, false);
        var next = queue.Enqueue(() => { order.Add(2); return Task.CompletedTask; }, false);
        await queue.Enqueue(() => { order.Add(0); return Task.CompletedTask; }, true).WaitAsync(TimeSpan.FromSeconds(1));
        Assert(order.SequenceEqual(new[] { 0 }), "Visibility/clipboard controls waited for a slow native operation");
        release.SetResult(); await Task.WhenAll(slow,next);
        Assert(order.SequenceEqual(new[] { 0,1,2 }), "Browser operation ordering changed");
        Assert(Host.TrustedKeyPage(new Uri("https://console.groq.com/keys"), "groq"), "Trusted provider rejected");
        Assert(!Host.TrustedKeyPage(new Uri("https://console.groq.com.evil.invalid/keys"), "groq"), "Spoofed provider accepted");
        Assert(!Host.TrustedKeyPage(new Uri("http://console.groq.com/keys"), "groq"), "Insecure provider accepted");
        Assert(Host.Shortcut(0x4c, true, false, false) == "focus-url", "Ctrl+L mapping");
        Assert(Host.Shortcut(0x4c, false, false, false) == null, "Plain L intercepted");
        using var host = new Host(Environment.ProcessId, true); host.Show();
        async Task<object?> Call(string op, object args) { return await host.Execute(op, JsonSerializer.SerializeToElement(args)); }
        var listener = new TcpListener(IPAddress.Loopback, 0); listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        using var cancel = new CancellationTokenSource();
        var server = Serve(listener, cancel.Token);
        try
        {
            await Call("frame", new { x = 0, y = 0, width = 800, height = 500 });
            await Call("gesture", new { source = "", on = true });
            await Call("load", new { tab = 1, url = $"http://127.0.0.1:{port}/" });
            await Call("show", new { tab = 1 });
            var deadline = DateTime.UtcNow.AddSeconds(25); string? title = null;
            while (DateTime.UtcNow < deadline) { title = (string?)await Call("evaluate", new { tab = 1, source = "document.title" }); if (title == "Luna Test") break; await Task.Delay(100); }
            Assert(title == "Luna Test", "Native WebView2 navigation failed");
            Assert((string?)await Call("evaluate", new { tab = 1, source = "document.querySelector('#field').value='hello';document.querySelector('#field').value" }) == "hello", "DOM interaction failed");
            await Call("zoom", new { tab = 1, factor = 1.25 });
            await Call("appearance", new { mode = "dark" });
            var shot = (string?)await Call("screenshot", new { tab = 1 }); Assert(Convert.FromBase64String(shot!).Length > 100, "Screenshot missing"); Assert(Clipboard.ContainsImage(), "Screenshot not copied");
            await Call("load", new { tab = 2, url = $"http://127.0.0.1:{port}/next" });
            deadline=DateTime.UtcNow.AddSeconds(20);bool secondReady=false;
            while(DateTime.UtcNow<deadline){if((string?)await Call("evaluate",new{tab=2,source="document.title"})=="Luna Test"){secondReady=true;break;}await Task.Delay(100);}
            Assert(secondReady,"Second native tab did not navigate");

            await Call("show", new { tab = 2 }); await Call("close", new { tab = 2 }); await Call("show", new { tab = 1 });
            await Call("show", new { tab = -1 }); await Call("close", new { tab = 1 });
            await TestIPC($"http://127.0.0.1:{port}/");
        }
        finally { cancel.Cancel(); listener.Stop(); await server; }
    }
    static async Task Serve(TcpListener listener,CancellationToken token) {
        var clients=new List<Task>();
        try {
            while(!token.IsCancellationRequested) {
                var client=await listener.AcceptTcpClientAsync(token);
                clients.Add(ServeClient(client,token));
            }
        } catch(OperationCanceledException) {} finally { await Task.WhenAll(clients); }
    }
    static async Task ServeClient(TcpClient client,CancellationToken token) {
        using(client) using(var timeout=CancellationTokenSource.CreateLinkedTokenSource(token)) {
            timeout.CancelAfter(TimeSpan.FromSeconds(5));
            try {
                using var stream=client.GetStream();var buffer=new byte[8192];
                if(await stream.ReadAsync(buffer,timeout.Token)==0)return;
                var body=Encoding.UTF8.GetBytes("<!doctype html><title>Luna Test</title><h1>Native browser works</h1><input id='field'><a href='/next'>Next</a>");
                var header=Encoding.ASCII.GetBytes($"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {body.Length}\r\nConnection: close\r\n\r\n");
                await stream.WriteAsync(header,timeout.Token);await stream.WriteAsync(body,timeout.Token);
            } catch(Exception e) when(e is IOException or SocketException or OperationCanceledException) {
                // Chromium can abandon favicon requests and speculative connections.
                // A disconnected client must not stop the test server for other tabs.
            }
        }
    }
    static async Task TestIPC(string url) {
        var info=new ProcessStartInfo(Environment.ProcessPath!,Environment.ProcessId.ToString()) {UseShellExecute=false,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,CreateNoWindow=true};
        using var child=Process.Start(info)!;
        long id=0;
        async Task<JsonElement> Call(string op,object args){
            var expected=++id;
            await child.StandardInput.WriteLineAsync(JsonSerializer.Serialize(new{id=expected,op,args}));
            while(true){
                var line=await child.StandardOutput.ReadLineAsync().WaitAsync(TimeSpan.FromSeconds(25));
                if(line==null)throw new Exception("Native IPC closed: "+await child.StandardError.ReadToEndAsync());
                using var doc=JsonDocument.Parse(line);var r=doc.RootElement;
                if(!r.TryGetProperty("id",out var responseID)||responseID.GetInt64()!=expected)continue;
                if(r.TryGetProperty("error",out var error))throw new Exception(error.GetString());
                return r.GetProperty("result").Clone();
            }
        }
        try {
            await Call("frame",new{x=0,y=0,width=800,height=500});
            await Call("load",new{tab=3,url});
            await Call("show",new{tab=3});
            var deadline=DateTime.UtcNow.AddSeconds(20);bool ready=false;
            while(DateTime.UtcNow<deadline){if((await Call("evaluate",new{tab=3,source="document.title"})).GetString()=="Luna Test"){ready=true;break;}await Task.Delay(100);}
            Assert(ready,"Cross-process tab failed to navigate");
            await Call("evaluate",new{tab=3,source="window.__ticks=0;setInterval(()=>window.__ticks++,30);'ready'"});
            await Task.Delay(1500); // no pipe input: the STA must still pump browser events
            var ticks=(await Call("evaluate",new{tab=3,source="String(window.__ticks)"})).GetString();
            Assert(int.TryParse(ticks,out var n)&&n>10,"Native IPC blocked the browser UI while idle");
        } finally {
            child.StandardInput.Close();
            if(!child.WaitForExit(5000))child.Kill(true);
        }
    }

}
