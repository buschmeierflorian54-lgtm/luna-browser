// Gemeinsamer handgezeichneter Schriftzug, passend zum Startbildschirm.
export const lunaWordmark = `<svg class="luna-wordmark" viewBox="-8 0 420 96" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="luna browser">
      <path transform="translate(0 0)" d="M5 65 C17 54 34 26 29 15 C24 4 15 23 14 44 C12 61 12 77 23 72 L32 64"/>
      <path transform="translate(31 0)" d="M0 64 Q9 52 12 45 L6 64 C0 81 16 76 25 48 L19 66 Q16 80 31 64"/>
      <path transform="translate(61 0)" d="M0 64 L10 45 L5 67 C13 45 29 36 25 53 L21 66 Q18 79 34 64"/>
      <path transform="translate(94 0)" d="M25 49 C13 36 -2 57 3 69 C8 81 22 62 25 47 L21 66 Q19 80 35 65"/>
      <path transform="translate(149 0)" d="M0 65 C13 53 30 23 23 14 C17 7 10 26 9 46 L6 66 C4 82 26 73 27 55 C28 42 16 44 11 54 Q20 67 36 56"/>
      <path transform="translate(184 0)" d="M0 64 L9 46 Q7 58 19 47 Q26 44 23 51 L18 65 Q15 78 29 64"/>
      <path transform="translate(213 0)" d="M25 49 C12 36 -1 55 3 67 C8 81 28 66 25 51 Q28 60 36 54"/>
      <path transform="translate(247 0)" d="M0 58 L8 46 C-1 74 5 81 16 61 L23 47 C15 76 23 80 34 62 Q43 46 36 45 Q31 46 37 55 L44 56"/>
      <path transform="translate(291 0)" d="M0 64 Q13 52 18 44 C9 52 31 64 18 72 Q8 78 5 69 Q16 75 30 64"/>
      <path transform="translate(322 0)" d="M0 64 C23 61 29 44 17 45 C3 46 -1 72 12 74 Q24 76 34 64"/>
      <path transform="translate(355 0)" d="M0 64 L9 46 Q7 58 19 47 Q26 44 23 51 L18 65 Q15 81 37 66"/>
    </svg>`;

export const lunaMusicWordmark = `<svg class="luna-music-wordmark" viewBox="-8 0 360 96" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Luna Music">
      <path transform="translate(0 0)" d="M5 65 C17 54 34 26 29 15 C24 4 15 23 14 44 C12 61 12 77 23 72 L32 64"/>
      <path transform="translate(31 0)" d="M0 64 Q9 52 12 45 L6 64 C0 81 16 76 25 48 L19 66 Q16 80 31 64"/>
      <path transform="translate(61 0)" d="M0 64 L10 45 L5 67 C13 45 29 36 25 53 L21 66 Q18 79 34 64"/>
      <path transform="translate(94 0)" d="M25 49 C13 36 -2 57 3 69 C8 81 22 62 25 47 L21 66 Q19 80 35 65"/>
      <path transform="translate(149 0)" d="M0 64 L10 45 L5 67 C14 44 27 36 23 54 L19 67 C29 43 42 36 38 54 L34 67 Q32 79 46 64"/>
      <path transform="translate(194 0)" d="M0 64 Q9 52 12 45 L6 64 C0 81 16 76 25 48 L19 66 Q16 80 31 64"/>
      <path transform="translate(226 0)" d="M0 64 Q13 52 18 44 C9 52 31 64 18 72 Q8 78 5 69 Q16 75 30 64"/>
      <path transform="translate(257 0)" d="M0 64 L12 46 L7 64 Q3 80 20 65 M15 31 L16 30"/>
      <path transform="translate(278 0)" d="M0 64 Q5 42 21 46 Q28 49 20 53 M21 46 C5 39 -2 67 9 73 Q20 81 39 63"/>
    </svg>`;

// Same monoline handwriting as the Luna wordmarks, scoped to the settings title.
const settingsLetters = {
  E: [35, 'M32 20 C12 10 0 37 22 43 C-7 43 -2 80 27 72 L36 64'],
  i: [20, 'M0 64 L12 46 L7 64 Q3 80 20 65 M15 31 L16 30'],
  n: [33, 'M0 64 L10 45 L5 67 C13 45 29 36 25 53 L21 66 Q18 79 34 64'],
  s: [30, 'M0 64 Q13 52 18 44 C9 52 31 64 18 72 Q8 78 5 69 Q16 75 30 64'],
  t: [24, 'M0 64 Q14 45 21 25 L10 62 Q5 83 27 64 M5 44 L26 42'],
  e: [32, 'M0 64 C23 61 29 44 17 45 C3 46 -1 72 12 74 Q24 76 34 64'],
  l: [31, 'M0 65 C12 54 29 26 24 15 C19 4 10 23 9 44 C7 61 7 77 18 72 L31 64'],
  u: [31, 'M0 64 Q9 52 12 45 L6 64 C0 81 16 76 25 48 L19 66 Q16 80 31 64'],
  g: [32, 'M25 49 C13 36 -2 57 3 69 C8 81 22 62 25 47 L17 86 C9 116 -9 101 4 90 Q19 78 34 64'],
};
let settingsX = 0;
const settingsPaths = [...'Einstellungen']
  .map((letter) => {
    const [advance, path] = settingsLetters[letter];
    const x = settingsX;
    settingsX += advance;
    return `<path transform="translate(${x} 0)" d="${path}"/>`;
  })
  .join('');
export const settingsWordmark = `<svg class="settings-wordmark" viewBox="-8 4 ${settingsX + 18} 108" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${settingsPaths}</svg>`;
