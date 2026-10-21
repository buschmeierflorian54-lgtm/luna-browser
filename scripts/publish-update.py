#!/usr/bin/env python3
"""Internal operator tool: wait for CI, preserve release ref, sign, publish and verify."""
import argparse
import json
import pathlib
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPO = 'fcore247/luna-browser'
WORKFLOW = 'Build and test both platforms'

def run(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()

def select_run(runs, commit):
    return next((r for r in runs if r['headSha'] == commit and r['headBranch'] == 'main' and r['workflowName'] == WORKFLOW), None)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--notes-file', required=True, type=pathlib.Path)
    parser.add_argument('--wait', action='store_true', help='Wait up to 40 minutes for this exact main commit')
    parser.add_argument('--publish', action='store_true', help='Publish after validation; otherwise create draft')
    parser.add_argument('--dry-run', action='store_true', help='Inspect only; do not sign, push or publish')
    args = parser.parse_args()
    if not args.notes_file.is_file() or not args.notes_file.read_text().strip():
        raise SystemExit('Provide nonempty release notes.')
    if run('git','status','--porcelain'):
        raise SystemExit('Working tree must be clean.')
    commit = run('git','rev-parse','HEAD')
    version = json.loads((ROOT/'wails.json').read_text())['info']['productVersion']
    deadline = time.monotonic()+2400
    previous = None
    wake = None
    try:
        if not args.dry_run:
            wake = subprocess.Popen(['caffeinate','-i'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        while True:
            runs = json.loads(run('gh','run','list','--repo',REPO,'--branch','main','--limit','50','--json','databaseId,headSha,headBranch,workflowName,status,conclusion'))
            ci = select_run(runs,commit)
            state = f"{version}: {ci['status']} / {ci['conclusion'] or 'pending'}" if ci else f'{version}: waiting for main CI'
            if state != previous: print(state,flush=True); previous=state
            if args.dry_run: return
            if ci and ci['status']=='completed':
                if ci['conclusion']!='success': raise SystemExit('CI failed; nothing published.')
                break
            if not args.wait or time.monotonic()>deadline: raise SystemExit('CI not ready; use --wait or retry later.')
            time.sleep(20)
        ref = 'refs/heads/release/'+version
        remote = run('git','ls-remote','origin',ref)
        if remote and remote.split()[0] != commit:
            raise SystemExit('Release branch points to another commit; refusing to overwrite it.')
        if not remote: subprocess.run(['git','push','origin',f'{commit}:{ref}'],cwd=ROOT,check=True)
        command=['scripts/release.sh',str(ci['databaseId']),'--notes-file',str(args.notes_file.resolve())]
        if args.publish: command.append('--publish')
        subprocess.run(command,cwd=ROOT,check=True)
    finally:
        if wake: wake.terminate(); wake.wait()

if __name__=='__main__':
    main()
