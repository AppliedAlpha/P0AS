import { writeFileSync } from 'node:fs';
import qrcode from 'qrcode-generator';
import { ATTENDANCE_URL } from '../src/print-config.js';

const qr = qrcode(0, 'M');
qr.addData(ATTENDANCE_URL, 'Byte');
qr.make();
const svg = qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
writeFileSync(new URL('../public/attendance-qr.svg', import.meta.url), svg + '\n');
console.log(`Generated local QR: ${ATTENDANCE_URL}`);
