#!/usr/bin/env node
// Generates PWA PNG icons with no dependencies (hand-rolled PNG encoder).
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(size, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function draw(size) {
  const px = new Uint8Array(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= size || yi >= size) return;
    const i = (yi * size + xi) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  };

  // Indigo background with a subtle vertical gradient.
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const t = y / size;
      set(x, y, Math.round(79 + 20 * t), Math.round(70 + 30 * t), Math.round(229 - 20 * t));
    }
  }

  const cx = size / 2;
  const bodyTop = size * 0.48;
  const bodyBottom = size * 0.76;
  const bodyLeft = size * 0.34;
  const bodyRight = size * 0.66;

  // House body.
  for (let y = bodyTop; y < bodyBottom; y += 1) {
    for (let x = bodyLeft; x < bodyRight; x += 1) set(x, y, 255, 255, 255);
  }
  // Roof.
  const apexY = size * 0.28;
  const half = size * 0.22;
  for (let y = apexY; y < bodyTop; y += 1) {
    const progress = (y - apexY) / (bodyTop - apexY);
    const hw = half * progress;
    for (let x = cx - hw; x <= cx + hw; x += 1) set(x, y, 255, 255, 255);
  }
  // Door.
  const doorW = size * 0.1;
  const doorH = size * 0.14;
  for (let y = bodyBottom - doorH; y < bodyBottom; y += 1) {
    for (let x = cx - doorW / 2; x < cx + doorW / 2; x += 1) set(x, y, 79, 70, 229);
  }

  return encodePng(size, px);
}

mkdirSync('apps/web/public/icons', { recursive: true });
writeFileSync('apps/web/public/icons/icon-192.png', draw(192));
writeFileSync('apps/web/public/icons/icon-512.png', draw(512));
console.log('Wrote apps/web/public/icons/icon-192.png and icon-512.png');
