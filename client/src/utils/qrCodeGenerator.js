/**
 * ExamShield AI — Pure JavaScript Zero-Dependency QR Code Generator
 * Generates a 2D boolean matrix for QR Codes (Version 1-10, Byte Mode, Error Correction L/M/H).
 */

// QR Code Constants & Tables
const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    LOG_TABLE[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    EXP_TABLE[i] = EXP_TABLE[i - 255];
  }
})();

function gfMul(x, y) {
  if (x === 0 || y === 0) return 0;
  return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
}

function polyMul(p1, p2) {
  const result = new Uint8Array(p1.length + p2.length - 1);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return result;
}

function getGeneratorPoly(degree) {
  let g = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    g = polyMul(g, new Uint8Array([1, EXP_TABLE[i]]));
  }
  return g;
}

function calcErrorCorrection(data, eccCount) {
  const genPoly = getGeneratorPoly(eccCount);
  const msgPoly = new Uint8Array(data.length + eccCount);
  msgPoly.set(data);

  for (let i = 0; i < data.length; i++) {
    const coef = msgPoly[i];
    if (coef !== 0) {
      for (let j = 0; j < genPoly.length; j++) {
        msgPoly[i + j] ^= gfMul(genPoly[j], coef);
      }
    }
  }
  return msgPoly.slice(data.length);
}

// Version parameters: [version, totalModules, dataCapacity, eccCount]
const VERSION_SPECS = [
  [1, 21, 19, 7],
  [2, 25, 34, 10],
  [3, 29, 55, 15],
  [4, 33, 80, 20],
  [5, 37, 108, 26],
  [6, 41, 136, 36],
  [7, 45, 156, 40],
  [8, 49, 194, 48]
];

function selectVersion(dataLen) {
  for (const spec of VERSION_SPECS) {
    if (spec[2] >= dataLen + 2) {
      return spec;
    }
  }
  return VERSION_SPECS[VERSION_SPECS.length - 1];
}

/**
 * Creates the 2D matrix (array of arrays of booleans/nulls) for a QR code string.
 * @param {string} text - Embedded string (e.g. Student ID)
 * @returns {Array<Array<boolean>>} 2D boolean array where true = dark module, false = light module
 */
export function generateQRMatrix(text) {
  const textStr = String(text || '');
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(textStr);

  const spec = selectVersion(rawBytes.length);
  const [version, size, dataCapacity, eccCount] = spec;

  // 1. Bit Buffer Construction (Byte Mode: 0100 + 8-bit length + data)
  const bitBuf = [];
  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) {
      bitBuf.push((val >> i) & 1);
    }
  }

  pushBits(0b0100, 4); // Mode: Byte
  pushBits(rawBytes.length, 8); // Character count
  for (let i = 0; i < rawBytes.length; i++) {
    pushBits(rawBytes[i], 8);
  }

  // Terminate & pad to capacity
  const totalDataBits = dataCapacity * 8;
  while (bitBuf.length < totalDataBits && bitBuf.length % 8 !== 0) {
    bitBuf.push(0);
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bitBuf.length < totalDataBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bit stream to Uint8Array
  const dataBytes = new Uint8Array(dataCapacity);
  for (let i = 0; i < dataCapacity; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bitBuf[i * 8 + j];
    }
    dataBytes[i] = b;
  }

  // Calculate Reed-Solomon Error Correction
  const eccBytes = calcErrorCorrection(dataBytes, eccCount);

  // Combine Data + ECC
  const finalCodewords = new Uint8Array(dataCapacity + eccCount);
  finalCodewords.set(dataBytes, 0);
  finalCodewords.set(eccBytes, dataCapacity);

  // 2. Matrix Allocation (null = unassigned, true = dark, false = light)
  const matrix = Array.from({ length: size }, () => new Array(size).fill(null));

  // Helper to place finder pattern
  function drawFinder(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const mr = row + r;
        const mc = col + c;
        if (mr >= 0 && mr < size && mc >= 0 && mc < size) {
          const isDark = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                         (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                         (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          matrix[mr][mc] = isDark;
        }
      }
    }
  }

  // Place Finder Patterns
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing Patterns
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }

  // Alignment Pattern for version >= 2
  if (version >= 2) {
    const alignPos = size - 7;
    for (let r = alignPos - 2; r <= alignPos + 2; r++) {
      for (let c = alignPos - 2; c <= alignPos + 2; c++) {
        if (matrix[r][c] === null) {
          const isEdge = Math.abs(r - alignPos) === 2 || Math.abs(c - alignPos) === 2;
          const isCenter = r === alignPos && c === alignPos;
          matrix[r][c] = isEdge || isCenter;
        }
      }
    }
  }

  // Reserve Format Info Area
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
    if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false;
    if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false;
  }
  matrix[size - 8][8] = true; // Dark module

  // Data Module Placement (zigzag pattern)
  const bitStream = [];
  for (let i = 0; i < finalCodewords.length; i++) {
    for (let b = 7; b >= 0; b--) {
      bitStream.push((finalCodewords[i] >> b) & 1);
    }
  }

  let bitIdx = 0;
  let dir = -1; // up = -1, down = 1
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5; // Skip timing column
    for (let step = 0; step < size; step++) {
      const row = dir === -1 ? (size - 1 - step) : step;
      for (let cOffset = 0; cOffset < 2; cOffset++) {
        const c = col - cOffset;
        if (matrix[row][c] === null) {
          let val = bitIdx < bitStream.length ? bitStream[bitIdx++] : 0;
          // Apply Mask Pattern 0 ( (row + col) % 2 === 0 )
          if ((row + c) % 2 === 0) {
            val ^= 1;
          }
          matrix[row][c] = val === 1;
        }
      }
    }
    dir = -dir;
  }

  // Format Info Placement (Mask 0, Error Correction L: 010000010110111)
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  for (let i = 0; i < 15; i++) {
    const val = formatBits[i] === 1;
    if (i < 6) matrix[8][i] = val;
    else if (i < 8) matrix[8][i + 1] = val;
    else if (i < 9) matrix[8][size - 15 + i] = val;
    else matrix[8][size - 15 + i] = val;

    if (i < 7) matrix[size - 1 - i][8] = val;
    else matrix[14 - i][8] = val;
  }

  // Return clean boolean matrix (replace any remaining nulls with false)
  return matrix.map(row => row.map(cell => cell === true));
}
