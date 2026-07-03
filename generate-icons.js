const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function createPNG(size, r, g, b) {
  // Create raw RGBA pixel data (all same color)
  const raw = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cx = x - size/2, cy = y - size/2, dist = Math.sqrt(cx*cx + cy*cy);
      const maxR = size/2;
      // Circle with slight gradient
      if (dist > maxR) { raw[idx]=255; raw[idx+1]=255; raw[idx+2]=255; raw[idx+3]=0; }
      else {
        const t = dist/maxR;
        raw[idx] = Math.round(r + (255-r)*t*0.3);
        raw[idx+1] = Math.round(g + (255-g)*t*0.3);
        raw[idx+2] = Math.round(b + (255-b)*t*0.3);
        raw[idx+3] = 255;
      }
    }
  }

  // Convert to PNG
  // Each row: filter byte (0:none) + pixel data
  const rowSize = 1 + size * 4;
  const rawRows = Buffer.alloc(size * rowSize);
  for (let y = 0; y < size; y++) {
    rawRows[y*rowSize] = 0; // filter none
    raw.copy(rawRows, y*rowSize+1, y*size*4, (y+1)*size*4);
  }

  const deflated = zlib.deflateSync(rawRows);

  // PNG chunks
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crcData = Buffer.concat([Buffer.from(type), data]);
    const crc = crc32(crcData);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc);
    return Buffer.concat([len, Buffer.from(type), data, crcBuf]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);  // width
  ihdr.writeUInt32BE(size, 4);  // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const png = Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0))
  ]);
  return png;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const outDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Green theme icon (matching #16A34A)
fs.writeFileSync(path.join(outDir, 'icon-192.png'), createPNG(192, 22, 163, 74));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), createPNG(512, 22, 163, 74));
console.log('Icons created!');
