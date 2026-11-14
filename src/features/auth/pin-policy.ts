export function isSixDigitPin(value: string): boolean {
  return /^[0-9]{6}$/.test(value);
}
