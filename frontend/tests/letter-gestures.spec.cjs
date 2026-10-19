const { test, expect } = require('@playwright/test');
const path = require('node:path');
test('letter recognition at different scales and directions; no early action', async ({ page }) => {
  await page.setContent('<body style="height:1000px"><div>Draw here</div></body>');
  await page.addScriptTag({ path: path.join(__dirname, '../src/gesture-core.js') });
  await page.evaluate(() => {
    window.recognized = [];
    window.__fmCircle({ onLetter: (l) => window.recognized.push(l) });
    window.drawLetter = (letter, reverse = false) => {
      let points = window.__lunaLetterPaths[letter];
      if (reverse) points = points.slice().reverse();
      const line = [];
      for (let i = 1; i < points.length; i++)
        for (let j = 0; j < 20; j++) {
          const t = j / 20;
          line.push([
            160 + (points[i - 1][0] * (1 - t) + points[i][0] * t) * 130,
            150 + (points[i - 1][1] * (1 - t) + points[i][1] * t) * 180,
          ]);
        }
      line.push([160 + points.at(-1)[0] * 130, 150 + points.at(-1)[1] * 180]);
      const fire = (type, p, buttons) =>
        document.body.dispatchEvent(
          new MouseEvent(type, { bubbles: true, button: 0, buttons, clientX: p[0], clientY: p[1] }),
        );
      fire('mousedown', line[0], 1);
      line.slice(1).forEach((p) => fire('mousemove', p, 1));
      const before = window.recognized.length;
      fire('mouseup', line.at(-1), 0);
      return before;
    };
  });
  for (const letter of 'CDHIJLOPQVWZ') {
    const count = await page.evaluate((letter) => drawLetter(letter), letter);
    await expect.poll(() => page.evaluate(() => recognized.length)).toBe(count + 1);
    expect(await page.evaluate(() => recognized.at(-1)), letter).toBe(letter);
  }
  await page.evaluate(() => drawLetter('L', true));
  await expect.poll(() => page.evaluate(() => recognized.at(-1))).toBe('L');
});
