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
        var server = Task.Run(async () => { try { while (!cancel.IsCancellationRequested) { using var client = await listener.AcceptTcpClientAsync(cancel.Token); using var stream = client.GetStream(); var buffer = new byte[8192]; await stream.ReadAsync(buffer, cancel.Token); var body = Encoding.UTF8.GetBytes("<!doctype html><title>Luna Test</title><h1>Native browser works</h1><input id='field'><a href='/next'>Next</a>"); var header = Encoding.ASCII.GetBytes($"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {body.Length}\r\nConnection: close\r\n\r\n"); await stream.WriteAsync(header, cancel.Token); await stream.WriteAsync(body, cancel.Token); } } catch (OperationCanceledException) { } });
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
            await Call("show", new { tab = 2 }); await Call("close", new { tab = 2 }); await Call("show", new { tab = 1 });
            await Call("show", new { tab = -1 }); await Call("close", new { tab = 1 });
        }
        finally { cancel.Cancel(); listener.Stop(); await server; }
    }
}
