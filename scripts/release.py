#!/usr/bin/env python3
"""Prepare one signed release from a green two-platform CI run. Private keys stay in Keychain."""
import argparse
import hashlib
import json
import pathlib
import plistlib
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPO = "fcore247/luna-browser"

def run(*args, capture=False):
    return subprocess.run(args, cwd=ROOT, check=True, text=True,
                          stdout=subprocess.PIPE if capture else None).stdout

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_id", help="Successful 'Build and test both platforms' run ID")
    parser.add_argument("--publish", action="store_true", help="Publish after every asset has uploaded; otherwise leave a reviewable draft")
    args = parser.parse_args()
    if run("git", "status", "--porcelain", capture=True).strip():
        raise SystemExit("Commit all source changes before preparing a release.")
    commit = run("git", "rev-parse", "HEAD", capture=True).strip()
    status = json.loads(run("gh", "run", "view", args.run_id, "--repo", REPO,
                           "--json", "conclusion,headSha,headBranch,workflowName,jobs", capture=True))
    if (status["conclusion"] != "success" or status["headSha"] != commit
            or status["headBranch"] != "main" or status["workflowName"] != "Build and test both platforms"
            or not any(j["name"] == "Both platforms ready" and j["conclusion"] == "success" for j in status["jobs"])):
        raise SystemExit("Both platforms must pass CI on main for this exact commit.")
    version = json.loads((ROOT / "wails.json").read_text())["info"]["productVersion"]
    output = ROOT / "build" / "releases" / version
    if output.exists():
        raise SystemExit(f"Refusing to overwrite existing release staging: {output}")
    run("sh", "scripts/setup-sparkle.sh")
    expected = plistlib.loads((ROOT / "build/darwin/Info.plist").read_bytes())["SUPublicEDKey"]
    actual = run("build/sparkle/bin/generate_keys", "--account", "luna-browser-updates", "-p", capture=True).strip()
    if actual != expected:
        raise SystemExit("Signing key does not match installed clients.")
    with tempfile.TemporaryDirectory(prefix="luna-release-") as tmp:
        temp = pathlib.Path(tmp)
        run("gh", "run", "download", args.run_id, "--repo", REPO, "-D", str(temp))
        macdir = temp / "luna-macos-arm64"
        windir = temp / "luna-windows-amd64-EXPERIMENTAL"
        for folder in (macdir, windir):
            if (folder / "source-commit.txt").read_text(encoding="utf-8-sig").strip() != commit:
                raise SystemExit("Artifact provenance does not match source commit.")
        maczip = f"Luna-Browser-{version}-macos-arm64.zip"
        winzip = f"Luna-Browser-{version}-windows-amd64.zip"
        if not (macdir/maczip).is_file() or not (windir/winzip).is_file():
            raise SystemExit("Both platform archives are required.")
        appdir = temp / "app"
        run("ditto", "-x", "-k", str(macdir/maczip), str(appdir))
        app = appdir / "Luna Browser.app"
        info = plistlib.loads((app / "Contents/Info.plist").read_bytes())
        if info["CFBundleShortVersionString"] != version or info["SUPublicEDKey"] != expected:
            raise SystemExit("macOS artifact version/signing identity mismatch.")
        run("codesign", "--verify", "--deep", "--strict", str(app))
        # Appcast generation sees only the Mac archive; no Windows zip is mistaken for an app.
        run("build/sparkle/bin/generate_appcast", "--account", "luna-browser-updates",
            "--maximum-deltas", "0", "--download-url-prefix",
            f"https://github.com/{REPO}/releases/download/v{version}/", str(macdir))
        output.mkdir(parents=True)
        for src in (macdir/maczip, macdir/"appcast.xml", windir/winzip):
            shutil.copy2(src, output/src.name)
        run("bash", "scripts/make-dmg.sh", str(app), str(output))
        windows = output / winzip
        manifest = {"version": version, "url": f"https://github.com/{REPO}/releases/download/v{version}/{winzip}",
                    "sha256": hashlib.sha256(windows.read_bytes()).hexdigest(), "size": windows.stat().st_size,
                    "experimental": True}
        metadata = output / "windows-update.json"
        metadata.write_text(json.dumps(manifest, indent=2)+"\n")
        signature = run("build/sparkle/bin/sign_update", "--account", "luna-browser-updates", "-p",
                        str(metadata), capture=True).strip()
        run("build/sparkle/bin/sign_update", "--account", "luna-browser-updates", "--verify", str(metadata), signature)
        (output / "windows-update.sig").write_text(signature+"\n")
        checksums = "".join(f"{hashlib.sha256(f.read_bytes()).hexdigest()}  {f.name}\n"
                            for f in sorted(output.iterdir()) if f.name != "SHA256SUMS")
        (output / "SHA256SUMS").write_text(checksums)
        notes = output / "release-notes.md"
        notes.write_text(f"Luna Browser {version} für macOS und Windows – gemeinsamer Quellstand `{commit}`.\n\n"
                         "**Windows ist experimentell und instabil.** Noch keine stabile Windows-Freigabe; "
                         "bekannte Einschränkungen und Laptop-Testliste stehen in docs/WINDOWS-TEST.md.\n\n"
                         f"Beide Plattformen erfolgreich geprüft: https://github.com/{REPO}/actions/runs/{args.run_id}\n\n"
                         "Windows: ZIP vollständig in einen eigenen Ordner entpacken, dann Luna Browser.exe starten. "
                         "Der native-Unterordner muss daneben bleiben. macOS: vorhandenen Installer verwenden.\n")
        assets = [str(f) for f in sorted(output.iterdir()) if f != notes]
        run("gh", "release", "create", "v"+version, *assets, "--repo", REPO, "--target", commit,
            "--draft", "--title", f"Luna Browser {version} · Windows experimentell", "--notes-file", str(notes))
        if args.publish:
            run("gh", "release", "edit", "v"+version, "--repo", REPO, "--draft=false", "--latest")
        print(f"{'Published' if args.publish else 'Draft prepared'}: https://github.com/{REPO}/releases/tag/v{version}")

if __name__ == "__main__":
    main()
