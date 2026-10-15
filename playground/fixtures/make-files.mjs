/**
 * Makes the sample files the playground keeps, one of each type MemorySmith accepts (#77), into
 * `fixtures/files/`, with `fixtures/files.json` listing their attributes. It is run by hand when the
 * samples change, and its output is committed: the playground only reads it.
 *
 *   node fixtures/make-files.mjs        (in playground/, with Chromium installed for Playwright)
 *
 * What a browser encodes — JPEG, WebP, a WebM sound, a WebM and an MP4 clip — is made in Chromium;
 * the rest here. MP3, Ogg and QuickTime cannot be encoded with what the repository has, so those
 * three carry the bytes of another format their description names, which a browser still plays.
 */

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'files');
mkdirSync(out, { recursive: true });

// ── Made here ────────────────────────────────────────────────────────────────

function wav(seconds = 1, rate = 8000) {
  const samples = seconds * rate;
  const bytes = Buffer.alloc(44 + samples);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + samples, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate, 28);
  bytes.writeUInt16LE(1, 32);
  bytes.writeUInt16LE(8, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(samples, 40);
  for (let i = 0; i < samples; i++) bytes[44 + i] = 128 + Math.round(60 * Math.sin((2 * Math.PI * 440 * i) / rate) * Math.min(1, (samples - i) / 800));
  return bytes;
}

function pdf(title) {
  const body = `BT /F1 20 Tf 72 720 Td (${title}) Tj ET BT /F1 12 Tf 72 690 Td (A one-page PDF the playground keeps as a sample.) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let text = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(text.length);
    text += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const table = text.length;
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${table}\n%%EOF\n`;
  return Buffer.from(text, 'latin1');
}

const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160">
  <rect width="320" height="160" rx="12" fill="#e8eefb"/>
  <circle cx="80" cy="80" r="44" fill="#0f56d7"/>
  <rect x="150" y="48" width="130" height="18" rx="9" fill="#0f56d7" opacity=".7"/>
  <rect x="150" y="80" width="100" height="18" rx="9" fill="#0f56d7" opacity=".45"/>
  <text x="160" y="140" font-family="sans-serif" font-size="14" fill="#1b2433">SVG sample</text>
</svg>
`,
);

/** A GIF of two colours, its LZW written uncompressed: a clear code after every two pixels keeps every code three bits. */
function gif(width = 96, height = 48) {
  const pixel = (x, y) => ((Math.floor(x / 12) + Math.floor(y / 12)) % 2);
  const codes = [];
  let run = 0;
  codes.push(4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      codes.push(pixel(x, y));
      if (++run === 2) {
        codes.push(4);
        run = 0;
      }
    }
  codes.push(5);
  const packed = [];
  let buffer = 0;
  let bits = 0;
  for (const code of codes) {
    buffer |= code << bits;
    bits += 3;
    while (bits >= 8) {
      packed.push(buffer & 0xff);
      buffer >>= 8;
      bits -= 8;
    }
  }
  if (bits > 0) packed.push(buffer & 0xff);
  const blocks = [];
  for (let i = 0; i < packed.length; i += 255) blocks.push(packed.length - i >= 255 ? 255 : packed.length - i, ...packed.slice(i, i + 255));
  const header = Buffer.from('GIF89a');
  const screen = Buffer.from([width & 255, width >> 8, height & 255, height >> 8, 0x80, 0, 0, 0x0f, 0x56, 0xd7, 0xe8, 0xee, 0xfb]);
  const image = Buffer.from([0x2c, 0, 0, 0, 0, width & 255, width >> 8, height & 255, height >> 8, 0, 2]);
  return Buffer.concat([header, screen, image, Buffer.from(blocks), Buffer.from([0, 0x3b])]);
}

/** A Zip archive, stored without compression, as an Office document is one. */
function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const data = Buffer.from(text);
    const nameBytes = Buffer.from(name);
    const crc = crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG = 'http://schemas.openxmlformats.org/package/2006';
const rels = (items) => `${XML}<Relationships xmlns="${PKG}/relationships">${items.map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`).join('')}</Relationships>`;
const types = (overrides) =>
  `${XML}<Types xmlns="${PKG}/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides.map(([part, type]) => `<Override PartName="${part}" ContentType="${type}"/>`).join('')}</Types>`;
const OFFICE = 'application/vnd.openxmlformats-officedocument';

const docx = zip([
  ['[Content_Types].xml', types([['/word/document.xml', `${OFFICE}.wordprocessingml.document.main+xml`]])],
  ['_rels/.rels', rels([['rId1', 'officeDocument', 'word/document.xml']])],
  ['word/document.xml', `${XML}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>A Word document the playground keeps as a sample.</w:t></w:r></w:p></w:body></w:document>`],
]);

const xlsx = zip([
  ['[Content_Types].xml', types([['/xl/workbook.xml', `${OFFICE}.spreadsheetml.sheet.main+xml`], ['/xl/worksheets/sheet1.xml', `${OFFICE}.spreadsheetml.worksheet+xml`]])],
  ['_rels/.rels', rels([['rId1', 'officeDocument', 'xl/workbook.xml']])],
  ['xl/workbook.xml', `${XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}"><sheets><sheet name="Sample" sheetId="1" r:id="rId1"/></sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels', rels([['rId1', 'worksheet', 'worksheets/sheet1.xml']])],
  ['xl/worksheets/sheet1.xml', `${XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Grape</t></is></c><c r="B1" t="inlineStr"><is><t>Tons</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Cabernet</t></is></c><c r="B2"><v>8</v></c></row></sheetData></worksheet>`],
]);

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const tree = (shapes = '') => `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shapes}</p:spTree></p:cSld>`;
const pptx = zip([
  [
    '[Content_Types].xml',
    types([
      ['/ppt/presentation.xml', `${OFFICE}.presentationml.presentation.main+xml`],
      ['/ppt/slides/slide1.xml', `${OFFICE}.presentationml.slide+xml`],
      ['/ppt/slideLayouts/slideLayout1.xml', `${OFFICE}.presentationml.slideLayout+xml`],
      ['/ppt/slideMasters/slideMaster1.xml', `${OFFICE}.presentationml.slideMaster+xml`],
      ['/ppt/theme/theme1.xml', `${OFFICE}.theme+xml`],
    ]),
  ],
  ['_rels/.rels', rels([['rId1', 'officeDocument', 'ppt/presentation.xml']])],
  [
    'ppt/presentation.xml',
    `${XML}<p:presentation xmlns:p="${P}" xmlns:r="${REL}" xmlns:a="${A}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
  ],
  ['ppt/_rels/presentation.xml.rels', rels([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ['rId2', 'slide', 'slides/slide1.xml'], ['rId3', 'theme', 'theme/theme1.xml']])],
  [
    'ppt/slides/slide1.xml',
    `${XML}<p:sld xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${REL}">${tree(`<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="7315200" cy="1371600"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="3200"/><a:t>A sample presentation</a:t></a:r></a:p></p:txBody></p:sp>`)}<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
  ],
  ['ppt/slides/_rels/slide1.xml.rels', rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']])],
  ['ppt/slideLayouts/slideLayout1.xml', `${XML}<p:sldLayout xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${REL}" type="blank">${tree()}<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`],
  ['ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']])],
  [
    'ppt/slideMasters/slideMaster1.xml',
    `${XML}<p:sldMaster xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${REL}">${tree()}<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`,
  ],
  ['ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'theme', '../theme/theme1.xml']])],
  [
    'ppt/theme/theme1.xml',
    `${XML}<a:theme xmlns:a="${A}" name="Sample"><a:themeElements><a:clrScheme name="Sample">${['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']
      .map((name, index) => `<a:${name}><a:srgbClr val="${index % 2 === 0 ? '1B2433' : 'FFFFFF'}"/></a:${name}>`)
      .join('')}</a:clrScheme><a:fontScheme name="Sample"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Sample"><a:fillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${'<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'.repeat(3)}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`,
  ],
]);

// ── Made in Chromium ─────────────────────────────────────────────────────────

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.goto('about:blank');
const made = await page.evaluate(async () => {
  const toBase64 = async (blob) => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  };
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  const paint = (frame, label) => {
    const gradient = context.createLinearGradient(0, 0, 320, 160);
    gradient.addColorStop(0, '#0f56d7');
    gradient.addColorStop(1, '#7aa5f0');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 320, 160);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(60 + ((frame * 6) % 200), 80, 30, 0, Math.PI * 2);
    context.fill();
    context.font = 'bold 22px sans-serif';
    context.fillText(label, 150, 150);
  };
  const image = async (type, label) => {
    paint(0, label);
    return toBase64(await new Promise((done) => canvas.toBlob(done, type, 0.85)));
  };
  const record = (stream, type, seconds, tick) =>
    new Promise((done) => {
      const recorder = new MediaRecorder(stream, { mimeType: type });
      const chunks = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = async () => done(await toBase64(new Blob(chunks, { type })));
      recorder.start();
      let frame = 0;
      const timer = tick ? setInterval(() => tick(frame++), 1000 / 30) : null;
      setTimeout(() => {
        if (timer) clearInterval(timer);
        recorder.stop();
        stream.getTracks().forEach((track) => track.stop());
      }, seconds * 1000);
    });
  const sound = async () => {
    const audio = new AudioContext();
    await audio.resume();
    const oscillator = audio.createOscillator();
    oscillator.frequency.value = 523.25;
    const gain = audio.createGain();
    gain.gain.value = 0.2;
    const target = audio.createMediaStreamDestination();
    oscillator.connect(gain).connect(target);
    oscillator.start();
    const result = await record(target.stream, 'audio/webm;codecs=opus', 1.5);
    oscillator.stop();
    return result;
  };
  const clip = (type, label) => record(canvas.captureStream(30), type, 2, (frame) => paint(frame, label));
  return {
    png: await image('image/png', 'PNG sample'),
    jpeg: await image('image/jpeg', 'JPEG sample'),
    webp: await image('image/webp', 'WebP sample'),
    weba: await sound(),
    webm: await clip('video/webm;codecs=vp8', 'WebM sample'),
    mp4: await clip('video/mp4;codecs=avc1.42E01E', 'MP4 sample'),
  };
});
await browser.close();
const from = (base64) => Buffer.from(base64, 'base64');

// ── The samples and their attributes ─────────────────────────────────────────

const samples = [
  ['sample.png', 'image/png', from(made.png), 'A PNG image made in Chromium.'],
  ['sample.jpg', 'image/jpeg', from(made.jpeg), 'A JPEG image made in Chromium.'],
  ['sample.webp', 'image/webp', from(made.webp), 'A WebP image made in Chromium.'],
  ['sample.gif', 'image/gif', gif(), 'A GIF of two colours, written by hand.'],
  ['sample.svg', 'image/svg+xml', svg, 'An SVG drawing.'],
  ['sample.pdf', 'application/pdf', pdf('PDF sample'), 'A one-page PDF.'],
  ['sample.mp3', 'audio/mpeg', wav(), 'Stands for an MP3: the repository has no MP3 encoder, so its bytes are a WAV tone, which a browser plays all the same.'],
  ['sample.wav', 'audio/wav', wav(), 'A second of a 440 Hz tone.'],
  ['sample.ogg', 'audio/ogg', from(made.weba), 'Stands for an Ogg: Chromium records no Ogg, so its bytes are an Opus sound in WebM.'],
  ['sample.weba', 'audio/webm', from(made.weba), 'An Opus sound in WebM, recorded in Chromium.'],
  ['sample.mp4', 'video/mp4', from(made.mp4), 'An H.264 clip in MP4, recorded in Chromium.'],
  ['sample.webm', 'video/webm', from(made.webm), 'A VP8 clip in WebM, recorded in Chromium.'],
  ['sample.mov', 'video/quicktime', from(made.mp4), 'Stands for a QuickTime movie: its bytes are the MP4 clip, the format QuickTime grew from. Chromium plays no QuickTime type, so its player stays empty there.'],
  ['sample.docx', `${OFFICE}.wordprocessingml.document`, docx, 'A Word document of one paragraph, written by hand.'],
  ['sample.xlsx', `${OFFICE}.spreadsheetml.sheet`, xlsx, 'An Excel sheet of two rows, written by hand.'],
  ['sample.pptx', `${OFFICE}.presentationml.presentation`, pptx, 'A PowerPoint presentation of one slide, written by hand.'],
];
for (const [name, , bytes] of samples) writeFileSync(join(out, name), bytes);
writeFileSync(
  join(here, 'files.json'),
  `${JSON.stringify(samples.map(([name, mimeType, , description]) => ({ name, mimeType, description })), null, 2)}\n`,
);
console.log(samples.map(([name, , bytes]) => `${name} ${bytes.length}`).join('\n'));
