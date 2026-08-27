function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function wrap(context, text, x, y, width, lineHeight, maxLines) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const next = `${line}${line ? ' ' : ''}${word}`;
    if (context.measureText(next).width > width && line) {
      context.fillText(line, x, y + lines * lineHeight);
      line = word;
      lines += 1;
      if (lines === maxLines - 1) break;
    } else {
      line = next;
    }
  }
  if (line) context.fillText(line, x, y + lines * lineHeight);
}

function drawBriefingFrame(context, answer, phase) {
  context.fillStyle = '#090f20';
  context.fillRect(0, 0, 640, 360);
  context.fillStyle = '#171d42';
  context.beginPath();
  context.arc(560, 13, 200, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#715cf3';
  roundRect(context, 36, 32, 46, 46, 14);
  context.fillStyle = '#ffffff';
  context.font = '700 25px Manrope';
  context.fillText('✦', 49, 64);
  context.fillStyle = '#c7c2ff';
  context.font = '500 12px DM Mono';
  context.fillText('VERTEX AGENT · SHAREABLE BRIEFING', 98, 52);
  context.fillStyle = '#ffffff';
  context.font = '800 32px Manrope';
  wrap(context, answer.gifTitle, 38, 132, 530, 39, 2);
  context.fillStyle = '#9faaca';
  context.font = '500 16px Manrope';
  wrap(context, answer.body, 38, 223, 555, 23, 3);
  context.fillStyle = phase === 1 ? '#7160ed' : '#1d2b4a';
  roundRect(context, 38, 294, 564, 1, 0);

  if (phase === 1) {
    context.fillStyle = '#8b7cff';
    roundRect(context, 38, 313, 188, 29, 8);
    context.fillStyle = '#ffffff';
    context.font = '700 14px Manrope';
    context.fillText(answer.gifStat, 51, 333);
    return;
  }

  context.fillStyle = '#4bd09c';
  context.beginPath();
  context.arc(46, 327, 6, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#d7deed';
  context.font = '600 13px Manrope';
  context.fillText(`Evidence: ${answer.sources.join(' · ')}`, 61, 332);
}

function nearestPaletteIndex(red, green, blue, palette) {
  let best = 0;
  let distance = Infinity;
  for (let index = 0; index < palette.length; index += 1) {
    const [paletteRed, paletteGreen, paletteBlue] = palette[index];
    const nextDistance = (red - paletteRed) ** 2 + (green - paletteGreen) ** 2 + (blue - paletteBlue) ** 2;
    if (nextDistance < distance) {
      distance = nextDistance;
      best = index;
    }
  }
  return best;
}

function bytes16(value) {
  return [value & 255, (value >> 8) & 255];
}

function lzw(indices, minCodeSize) {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  let dictionary;
  let nextCode;
  let codeSize;
  const output = [];
  let current = 0;
  let bitCount = 0;

  function emit(code) {
    current |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      output.push(current & 255);
      current >>= 8;
      bitCount -= 8;
    }
  }

  function reset() {
    dictionary = new Map();
    for (let index = 0; index < clear; index += 1) dictionary.set(String(index), index);
    nextCode = end + 1;
    codeSize = minCodeSize + 1;
  }

  reset();
  emit(clear);
  let prefix = indices[0];
  for (let index = 1; index < indices.length; index += 1) {
    const value = indices[index];
    const key = `${prefix},${value}`;
    if (dictionary.has(key)) {
      prefix = dictionary.get(key);
      continue;
    }
    emit(prefix);
    if (nextCode < 4096) {
      dictionary.set(key, nextCode);
      nextCode += 1;
      if (nextCode === (1 << codeSize) && codeSize < 12) codeSize += 1;
    } else {
      emit(clear);
      reset();
    }
    prefix = value;
  }
  emit(prefix);
  emit(end);
  if (bitCount > 0) output.push(current & 255);
  return output;
}

function gifDataBlock(bytes) {
  const output = [];
  for (let index = 0; index < bytes.length; index += 255) {
    const block = bytes.slice(index, index + 255);
    output.push(block.length, ...block);
  }
  output.push(0);
  return output;
}

function encodeGif(frames, width, height, palette) {
  const tableSize = 1 << Math.ceil(Math.log2(palette.length));
  const colorBits = Math.log2(tableSize);
  const output = [
    ...new TextEncoder().encode('GIF89a'),
    ...bytes16(width),
    ...bytes16(height),
    0x80 | 0x70 | (colorBits - 1),
    0,
    0
  ];
  for (let index = 0; index < tableSize; index += 1) output.push(...(palette[index] || [0, 0, 0]));
  output.push(0x21, 0xff, 0x0b, ...new TextEncoder().encode('NETSCAPE2.0'), 0x03, 0x01, 0, 0, 0);
  const minCodeSize = Math.max(2, colorBits);
  for (const frame of frames) {
    output.push(
      0x21, 0xf9, 0x04, 0x04, ...bytes16(85), 0, 0,
      0x2c, 0, 0, 0, 0, ...bytes16(width), ...bytes16(height), 0,
      minCodeSize, ...gifDataBlock(lzw(frame, minCodeSize))
    );
  }
  output.push(0x3b);
  return new Uint8Array(output);
}

export function downloadGif(answer) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const palette = [
    [9, 15, 32], [23, 29, 66], [113, 92, 243], [199, 194, 255],
    [255, 255, 255], [159, 170, 202], [75, 208, 156], [29, 43, 74],
    [215, 222, 237], [99, 112, 141], [137, 124, 255], [94, 78, 216],
    [28, 43, 83], [31, 54, 66], [101, 90, 168], [47, 65, 104]
  ];
  const frames = [0, 1].map(phase => {
    drawBriefingFrame(context, answer, phase);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const indexed = new Uint8Array(canvas.width * canvas.height);
    for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
      indexed[pixel] = nearestPaletteIndex(pixels[index], pixels[index + 1], pixels[index + 2], palette);
    }
    return indexed;
  });
  const blob = new Blob([encodeGif(frames, canvas.width, canvas.height, palette)], { type: 'image/gif' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `vertex-briefing-${new Date().toISOString().slice(0, 10)}.gif`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
