const { test } = require('@playwright/test');
const path = require('node:path');

test('screenshot-timer', async ({ browser }) => {
  const b = browser;
  const p = await b.newPage();
  await p.setContent('<body style="background:white"><h1>Screenshot ohne Gestenspur</h1></body>');
  await p.addScriptTag({ path: path.join(__dirname, '../src/gesture-core.js') });
  await p.evaluate(() => {
    window.calls = 0;
    window.frames = 0;
    function frame() {
      window.frames++;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    window.detach = window.__fmCircle({
      onLetter: (letter) => {
        if (letter !== 'S') throw Error('Expected S');
        window.calls++;
        window.canvasAtShot = !!document.querySelector('canvas');
        window.shotFrame = window.frames;
      },
    });
    window.drawS = () => {
      const points = [];
      for (let i = 0; i <= 40; i++) {
        const a = ((-30 - (240 * i) / 40) * Math.PI) / 180;
        points.push([400 + Math.cos(a) * 90, 220 + (-0.5 + Math.sin(a) * 0.5) * 180]);
      }
      for (let i = 1; i <= 40; i++) {
        const a = ((-90 + (240 * i) / 40) * Math.PI) / 180;
        points.push([400 + Math.cos(a) * 90, 220 + (0.5 + Math.sin(a) * 0.5) * 180]);
      }
      const fire = (type, xy, buttons) =>
        document.body.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            button: 0,
            buttons,
            clientX: xy[0],
            clientY: xy[1],
          }),
        );
      fire('mousedown', points[0], 1);
      points.slice(1).forEach((x) => fire('mousemove', x, 1));
      window.trailBeforeRelease = !!document.querySelector('canvas');
      window.releaseFrame = window.frames;
      fire('mouseup', points.at(-1), 0);
      window.trailAfterRelease = !!document.querySelector('canvas');
      window.callsAtRelease = window.calls;
    };
    window.drawS();
  });
  await p.waitForFunction(() => window.calls === 1);
  const state = await p.evaluate(() => ({
    before: trailBeforeRelease,
    after: trailAfterRelease,
    atShot: canvasAtShot,
    immediate: callsAtRelease,
    frames: shotFrame - releaseFrame,
  }));
  if (!state.before || state.after || state.atShot || state.immediate || state.frames < 2)
    throw Error(JSON.stringify(state));
  await p.evaluate(() => {
    window.requestAnimationFrame = () => 0;
    window.drawS();
  });
  await p.waitForFunction(() => window.calls === 2);
  if (await p.evaluate(() => window.canvasAtShot)) throw Error('trail in fallback shot');
  await p.evaluate(() => {
    window.drawS();
    window.detach();
  });
  await p.waitForTimeout(100);
  if ((await p.evaluate(() => window.calls)) !== 2) throw Error('detached gesture still fired');
  console.log(
    'PASS: S trail removed before capture, capture works even with paused animation frames; detach cancels pending capture.',
    state,
  );
});
