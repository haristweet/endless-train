// 絵で確かめる台本：決まった時刻のコマを描いて1枚の一覧にする
//   python3 -m http.server 8803 &  node test/shots.mjs [出力.png]
// 既定は沿線ごとに昼と夜を並べる。BAD END を見るとき：
//   TIMES=13,14.5,16.2,17.3,17.6,18,18.8,19.6 ROWS='[["city","solid",false,"noon",true]]'
//   ROWS の各行は［沿線・描き方・飾り・走り始め・BAD END］。BAD END は 20 秒の無音の曲を入れて、17.4 秒で脱線する
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || 'shots.png';
const LEN = 20;
const TIMES = (process.env.TIMES || '6,30,55').split(',').map(Number);
const KINDS = ['city', 'rural', 'mountain', 'coast', 'snow'];
const ROWS = JSON.parse(process.env.ROWS || JSON.stringify(KINDS.flatMap(k => [[k, 'solid', false, 'noon', false], [k, 'solid', false, 'night', false]])));
const sr = 8000, n = sr * LEN, wav = Buffer.alloc(44 + n * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + n * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sr, 24); wav.writeUInt32LE(sr * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(n * 2, 40);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.error('pageerror', e.message));
await p.goto('http://localhost:8803/');
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.setInputFiles('#afile', { name: 'test.wav', mimeType: 'audio/wav', buffer: wav });
await p.waitForFunction(() => typeof snd !== 'undefined' && snd);
const cells = [];
for (const [scene, style, deco, start, bad] of ROWS) for (const t of TIMES) {
  cells.push(await p.evaluate(([scene, style, deco, start, bad, t]) => {
    playing = false; exporting = true;
    Object.assign(cfg, { style, deco, aspect: '16:9', seed: 1234, scenes: [scene], start, badEnd: !!bad });
    const s = newSim(), dt = 1 / 30;
    for (let k = 0; k < Math.round(t / dt); k++) s.update(dt);
    const c = document.createElement('canvas'); c.width = 480; c.height = 270;
    drawFrame(c.getContext('2d'), 480, 270, s, lookFor(s));
    return c.toDataURL();
  }, [scene, style, deco, start, bad, t]));
}
const html = `<body style="margin:0;background:#222;color:#ccc;font:12px sans-serif"><div style="display:grid;grid-template-columns:repeat(${TIMES.length},240px);gap:2px">`
  + TIMES.map(t => `<div>${t}s</div>`).join('') + cells.map(u => `<img src="${u}" width=240>`).join('') + '</div>';
await p.setContent(html);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log('wrote', out);
