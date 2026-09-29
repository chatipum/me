const DIGITS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const UNITS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

// n < 1,000,000; hasHigher = there are non-zero digits above this group (e.g. millions)
function readGroup(n: number, hasHigher: boolean): string {
  let out = '';
  const digits = String(n).split('').map(Number);
  digits.forEach((d, i) => {
    const position = digits.length - 1 - i;
    if (d === 0) return;
    if (position === 0) {
      out += d === 1 && (hasHigher || n >= 10) ? 'เอ็ด' : DIGITS[d];
    } else if (position === 1) {
      out += (d === 1 ? '' : d === 2 ? 'ยี่' : DIGITS[d]) + 'สิบ';
    } else {
      out += DIGITS[d] + UNITS[position];
    }
  });
  return out;
}

function readInteger(n: number): string {
  if (n >= 1_000_000) {
    const high = Math.floor(n / 1_000_000);
    return readInteger(high) + 'ล้าน' + readGroup(n % 1_000_000, true);
  }
  return readGroup(n, false);
}

export function bahtText(satang: number): string {
  const baht = Math.floor(satang / 100);
  const st = satang % 100;
  if (baht === 0 && st === 0) return 'ศูนย์บาทถ้วน';
  const bahtPart = baht > 0 ? readInteger(baht) + 'บาท' : '';
  const satangPart = st === 0 ? 'ถ้วน' : readGroup(st, false) + 'สตางค์';
  return bahtPart + satangPart;
}
