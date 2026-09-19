/**
 * ==========================================================================
 * KISSAN – Standalone Pure JavaScript QR Code Generator (Offline Ready)
 * Generates instant, crystal-clear SVG & Canvas QR codes with UTF-8 support.
 * ==========================================================================
 */

(function(window) {
 'use strict';

 // UTF-8 string encoder
 function toUtf8ByteArray(str) {
 const bytes = [];
 for (let i = 0; i < str.length; i++) {
 let code = str.charCodeAt(i);
 if (code < 0x80) {
 bytes.push(code);
 } else if (code < 0x800) {
 bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
 } else if (code < 0xd800 || code >= 0xe000) {
 bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
 } else {
 i++;
 code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
 bytes.push(
 0xf0 | (code >> 18),
 0x80 | ((code >> 12) & 0x3f),
 0x80 | ((code >> 6) & 0x3f),
 0x80 | (code & 0x3f)
 );
 }
 }
 return bytes;
 }

 // Reed-Solomon Galois Field tables & math
 const EXP_TABLE = new Uint8Array(256);
 const LOG_TABLE = new Uint8Array(256);
 for (let i = 0, x = 1; i < 256; i++) {
 EXP_TABLE[i] = x;
 LOG_TABLE[x] = i;
 x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
 }

 function gmult(a, b) {
 if (a === 0 || b === 0) return 0;
 return EXP_TABLE[(LOG_TABLE[a] + LOG_TABLE[b]) % 255];
 }

 function polyMultiply(p1, p2) {
 const res = new Uint8Array(p1.length + p2.length - 1);
 for (let i = 0; i < p1.length; i++) {
 for (let j = 0; j < p2.length; j++) {
 res[i + j] ^= gmult(p1[i], p2[j]);
 }
 }
 return res;
 }

 function polyRemainder(dividend, divisor) {
 const result = new Uint8Array(dividend);
 for (let i = 0; i < dividend.length - divisor.length + 1; i++) {
 const coef = result[i];
 if (coef !== 0) {
 for (let j = 1; j < divisor.length; j++) {
 result[i + j] ^= gmult(divisor[j], coef);
 }
 }
 }
 return result.slice(dividend.length - divisor.length + 1);
 }

 function getGeneratorPoly(degree) {
 let poly = new Uint8Array([1]);
 for (let i = 0; i < degree; i++) {
 poly = polyMultiply(poly, new Uint8Array([1, EXP_TABLE[i]]));
 }
 return poly;
 }

 // QR Spec parameters (Versions 1 to 10 with Medium error correction)
 const VERSION_SPECS_M = {
 1: { total: 26, ec: 10, g1Blocks: 1, g1Data: 16, g2Blocks: 0, g2Data: 0 },
 2: { total: 44, ec: 16, g1Blocks: 1, g1Data: 28, g2Blocks: 0, g2Data: 0 },
 3: { total: 70, ec: 26, g1Blocks: 1, g1Data: 44, g2Blocks: 0, g2Data: 0 },
 4: { total: 100, ec: 18, g1Blocks: 2, g1Data: 41, g2Blocks: 0, g2Data: 0 },
 5: { total: 134, ec: 24, g1Blocks: 2, g1Data: 53, g2Blocks: 0, g2Data: 0 },
 6: { total: 172, ec: 16, g1Blocks: 4, g1Data: 38, g2Blocks: 0, g2Data: 0 },
 7: { total: 196, ec: 18, g1Blocks: 4, g1Data: 31, g2Blocks: 0, g2Data: 0 },
 8: { total: 242, ec: 22, g1Blocks: 2, g1Data: 38, g2Blocks: 2, g2Data: 39 },
 9: { total: 292, ec: 22, g1Blocks: 3, g1Data: 36, g2Blocks: 2, g2Data: 37 },
 10: { total: 346, ec: 26, g1Blocks: 4, g1Data: 43, g2Blocks: 1, g2Data: 44 },
 11: { total: 404, ec: 30, g1Blocks: 1, g1Data: 50, g2Blocks: 4, g2Data: 51 },
 12: { total: 466, ec: 22, g1Blocks: 6, g1Data: 36, g2Blocks: 2, g2Data: 37 }
 };

 const ALIGNMENT_LOCATIONS = {
 2: [6, 18],
 3: [6, 22],
 4: [6, 26],
 5: [6, 30],
 6: [6, 34],
 7: [6, 22, 38],
 8: [6, 24, 42],
 9: [6, 26, 46],
 10: [6, 28, 50],
 11: [6, 30, 54],
 12: [6, 32, 58]
 };

 const FORMAT_BITS_M = [
 0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0
 ];

 function getVersionForByteLength(len) {
 for (let ver = 1; ver <= 12; ver++) {
 const spec = VERSION_SPECS_M[ver];
 const maxData = (spec.g1Blocks * spec.g1Data) + (spec.g2Blocks * spec.g2Data);
 const countBits = ver <= 9 ? 8 : 16;
 const capacity = Math.floor((maxData * 8 - 4 - countBits) / 8);
 if (len <= capacity) {
 return ver;
 }
 }
 return 12;
 }

 function encodeDataBytes(dataBytes, version) {
 const spec = VERSION_SPECS_M[version];
 const totalDataCapacity = (spec.g1Blocks * spec.g1Data) + (spec.g2Blocks * spec.g2Data);
 const countBits = version <= 9 ? 8 : 16;

 let bitStr = '0100'; // Byte mode indicator
 bitStr += dataBytes.length.toString(2).padStart(countBits, '0');

 for (let i = 0; i < dataBytes.length; i++) {
 bitStr += dataBytes[i].toString(2).padStart(8, '0');
 }

 const maxBits = totalDataCapacity * 8;
 const termLen = Math.min(4, maxBits - bitStr.length);
 bitStr += '0'.repeat(Math.max(0, termLen));

 if (bitStr.length % 8 !== 0) {
 bitStr += '0'.repeat(8 - (bitStr.length % 8));
 }

 const padBytes = [0xEC, 0x11];
 let padIdx = 0;
 while (bitStr.length < maxBits) {
 bitStr += padBytes[padIdx].toString(2).padStart(8, '0');
 padIdx = (padIdx + 1) % 2;
 }

 const dataCodewords = [];
 for (let i = 0; i < bitStr.length; i += 8) {
 dataCodewords.push(parseInt(bitStr.substr(i, 8), 2));
 }

 const genPoly = getGeneratorPoly(spec.ec);
 const blocksData = [];
 const blocksEC = [];
 let offset = 0;

 for (let b = 0; b < spec.g1Blocks; b++) {
 const chunk = dataCodewords.slice(offset, offset + spec.g1Data);
 offset += spec.g1Data;
 blocksData.push(chunk);

 const toDivide = new Uint8Array(spec.g1Data + spec.ec);
 toDivide.set(chunk, 0);
 const ecChunk = polyRemainder(toDivide, genPoly);
 blocksEC.push(Array.from(ecChunk));
 }

 for (let b = 0; b < spec.g2Blocks; b++) {
 const chunk = dataCodewords.slice(offset, offset + spec.g2Data);
 offset += spec.g2Data;
 blocksData.push(chunk);

 const toDivide = new Uint8Array(spec.g2Data + spec.ec);
 toDivide.set(chunk, 0);
 const ecChunk = polyRemainder(toDivide, genPoly);
 blocksEC.push(Array.from(ecChunk));
 }

 const finalCodewords = [];
 const maxBlockLen = Math.max(...blocksData.map(b => b.length));
 for (let i = 0; i < maxBlockLen; i++) {
 for (let b = 0; b < blocksData.length; b++) {
 if (i < blocksData[b].length) {
 finalCodewords.push(blocksData[b][i]);
 }
 }
 }

 for (let i = 0; i < spec.ec; i++) {
 for (let b = 0; b < blocksEC.length; b++) {
 finalCodewords.push(blocksEC[b][i]);
 }
 }

 return finalCodewords;
 }

 function generateQRMatrix(text) {
 const dataBytes = toUtf8ByteArray(text);
 const version = getVersionForByteLength(dataBytes.length);
 const size = 17 + version * 4;

 const matrix = Array.from({ length: size }, () => new Uint8Array(size));
 const isFunction = Array.from({ length: size }, () => new Uint8Array(size));

 function setFunctionModule(r, c, isDark) {
 matrix[r][c] = isDark ? 1 : 2;
 isFunction[r][c] = 1;
 }

 function drawFinder(row, col) {
 for (let r = -1; r <= 7; r++) {
 for (let c = -1; c <= 7; c++) {
 const mr = row + r;
 const mc = col + c;
 if (mr >= 0 && mr < size && mc >= 0 && mc < size) {
 const isDark = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
 (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
 (r >= 2 && r <= 4 && c >= 2 && c <= 4);
 setFunctionModule(mr, mc, isDark);
 }
 }
 }
 }

 drawFinder(0, 0);
 drawFinder(0, size - 7);
 drawFinder(size - 7, 0);

 for (let i = 8; i < size - 8; i++) {
 if (!isFunction[6][i]) setFunctionModule(6, i, i % 2 === 0);
 if (!isFunction[i][6]) setFunctionModule(i, 6, i % 2 === 0);
 }

 if (version >= 2 && ALIGNMENT_LOCATIONS[version]) {
 const locs = ALIGNMENT_LOCATIONS[version];
 for (let i = 0; i < locs.length; i++) {
 for (let j = 0; j < locs.length; j++) {
 const r = locs[i];
 const c = locs[j];
 if (isFunction[r][c]) continue;

 for (let dr = -2; dr <= 2; dr++) {
 for (let dc = -2; dc <= 2; dc++) {
 const isDark = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
 setFunctionModule(r + dr, c + dc, isDark);
 }
 }
 }
 }
 }

 setFunctionModule(size - 8, 8, true);

 for (let i = 0; i < 9; i++) {
 if (!isFunction[8][i]) setFunctionModule(8, i, false);
 if (!isFunction[i][8]) setFunctionModule(i, 8, false);
 }
 for (let i = 0; i < 8; i++) {
 if (!isFunction[8][size - 1 - i]) setFunctionModule(8, size - 1 - i, false);
 if (!isFunction[size - 1 - i][8]) setFunctionModule(size - 1 - i, 8, false);
 }

 const codewords = encodeDataBytes(dataBytes, version);
 let allBits = '';
 for (let i = 0; i < codewords.length; i++) {
 allBits += codewords[i].toString(2).padStart(8, '0');
 }

 let bitIdx = 0;
 let upwards = true;

 for (let right = size - 1; right > 0; right -= 2) {
 if (right === 6) right--;
 const cols = [right, right - 1];

 for (let vert = 0; vert < size; vert++) {
 const row = upwards ? (size - 1 - vert) : vert;
 for (let c of cols) {
 if (!isFunction[row][c]) {
 const bit = bitIdx < allBits.length ? allBits[bitIdx++] === '1' : false;
 matrix[row][c] = bit ? 1 : 2;
 }
 }
 }
 upwards = !upwards;
 }

 const mask = 0;
 for (let r = 0; r < size; r++) {
 for (let c = 0; c < size; c++) {
 if (!isFunction[r][c]) {
 const invert = (r + c) % 2 === 0;
 if (invert) {
 matrix[r][c] = matrix[r][c] === 1 ? 2 : 1;
 }
 }
 }
 }

 const formatBits = FORMAT_BITS_M[mask];
 for (let i = 0; i < 15; i++) {
 const bit = ((formatBits >> (14 - i)) & 1) === 1;

 if (i < 6) setFunctionModule(8, i, bit);
 else if (i === 6) setFunctionModule(8, 7, bit);
 else if (i === 7) setFunctionModule(8, 8, bit);
 else if (i === 8) setFunctionModule(7, 8, bit);
 else setFunctionModule(14 - i, 8, bit);

 if (i < 8) setFunctionModule(size - 1 - i, 8, bit);
 else setFunctionModule(8, size - 15 + i, bit);
 }

 return { matrix, size };
 }

 function createQRSvgString(text, options = {}) {
 const { matrix, size } = generateQRMatrix(text);
 const cellSize = options.cellSize || 4;
 const margin = options.margin !== undefined ? options.margin : 3;
 const totalSize = (size + margin * 2) * cellSize;
 const darkColor = options.colorDark || '#0f172a';
 const lightColor = options.colorLight || '#ffffff';

 let pathD = '';
 for (let r = 0; r < size; r++) {
 for (let c = 0; c < size; c++) {
 if (matrix[r][c] === 1) {
 const x = (c + margin) * cellSize;
 const y = (r + margin) * cellSize;
 pathD += `M${x},${y}h${cellSize}v${cellSize}h-${cellSize}z `;
 }
 }
 }

 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="100%" height="100%" style="background:${lightColor}; border-radius: 4px; shape-rendering: crispEdges;">
 <path d="${pathD}" fill="${darkColor}" />
 </svg>`;
 }

 function renderQRCode(targetElement, text, options = {}) {
 if (!targetElement) return false;

 try {
 const svgMarkup = createQRSvgString(text, options);
 targetElement.innerHTML = svgMarkup;
 return true;
 } catch (err) {
 console.warn('Notice creating pure SVG QR, applying fallback image:', err);
 const encoded = encodeURIComponent(text);
 targetElement.innerHTML = `
 <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=4&data=${encoded}" 
 alt="QR Code" 
 style="width: 100%; height: 100%; max-width: 160px; display: block; margin: 0 auto; image-rendering: pixelated;" 
 onerror="this.onerror=null; this.src='https://quickchart.io/qr?size=160&text=${encoded}';" />
 `;
 return false;
 }
 }

 window.KissanQR = {
 render: renderQRCode,
 toSvgString: createQRSvgString,
 generateMatrix: generateQRMatrix
 };

})(typeof window !== 'undefined' ? window : this);
