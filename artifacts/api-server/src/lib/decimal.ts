const SCALE = 6n;
const SCALE_FACTOR = 10n ** SCALE;

type DecimalInput = string | number | bigint | null | undefined;

function normalize(value: DecimalInput): string {
  if (value === null || value === undefined) return "0";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid decimal value");
    return value.toString();
  }
  return value.trim() || "0";
}

export function decimalToScaled(value: DecimalInput): bigint {
  const source = normalize(value);
  const sign = source.startsWith("-") ? -1n : 1n;
  const unsigned = source.replace(/^[+-]/, "");
  const [wholePart, fractionPart = ""] = unsigned.split(".");
  if (!/^\d+$/.test(wholePart) || !/^\d*$/.test(fractionPart)) {
    throw new Error(`Invalid decimal value: ${source}`);
  }
  const fraction = fractionPart.padEnd(Number(SCALE), "0");
  const roundedFraction = fraction.slice(0, Number(SCALE));
  const discarded = fractionPart.slice(Number(SCALE));
  let scaled = BigInt(wholePart || "0") * SCALE_FACTOR + BigInt(roundedFraction || "0");
  if (discarded[0] && discarded[0] >= "5") scaled += 1n;
  return sign * scaled;
}

export function scaledToDecimal(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / SCALE_FACTOR;
  const fraction = (absolute % SCALE_FACTOR).toString().padStart(Number(SCALE), "0").replace(/0+$/, "");
  return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function decimalAdd(...values: DecimalInput[]): string {
  const total = values.reduce<bigint>((sum, value) => sum + decimalToScaled(value), 0n);
  return scaledToDecimal(total);
}

export function decimalSubtract(left: DecimalInput, right: DecimalInput): string {
  return scaledToDecimal(decimalToScaled(left) - decimalToScaled(right));
}

export function decimalMultiply(left: DecimalInput, right: DecimalInput): string {
  return scaledToDecimal((decimalToScaled(left) * decimalToScaled(right)) / SCALE_FACTOR);
}

export function decimalDivide(left: DecimalInput, right: DecimalInput): string {
  const divisor = decimalToScaled(right);
  if (divisor === 0n) throw new Error("Cannot divide by zero");
  return scaledToDecimal((decimalToScaled(left) * SCALE_FACTOR) / divisor);
}

export function decimalCompare(left: DecimalInput, right: DecimalInput): number {
  const difference = decimalToScaled(left) - decimalToScaled(right);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function decimalMax(left: DecimalInput, right: DecimalInput): string {
  return decimalCompare(left, right) >= 0 ? normalize(left) : normalize(right);
}

export function decimalToNumber(value: DecimalInput): number {
  return Number(normalize(value));
}

export function decimalToMoneyNumber(value: DecimalInput): number {
  return Number(scaledToDecimal(decimalToScaled(value)));
}

export function decimalIsPositive(value: DecimalInput): boolean {
  return decimalCompare(value, 0) > 0;
}
