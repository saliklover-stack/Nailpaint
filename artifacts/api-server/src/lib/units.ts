import { decimalMultiply } from "./decimal";

export type MaterialUnitRule = {
  purchaseUnit: string;
  baseUnit: string;
  conversionFactor: string;
  packagingBottles: number;
};

const UNIT_RULES: Record<string, MaterialUnitRule> = {
  Brush: { purchaseUnit: "pcs", baseUnit: "pcs", conversionFactor: "1", packagingBottles: 1 },
  "Glass bottle": { purchaseUnit: "pcs", baseUnit: "pcs", conversionFactor: "1", packagingBottles: 1 },
  Cap: { purchaseUnit: "pcs", baseUnit: "pcs", conversionFactor: "1", packagingBottles: 1 },
  Chemical: { purchaseUnit: "L", baseUnit: "ml", conversionFactor: "1000", packagingBottles: 1 },
  Pigment: { purchaseUnit: "kg", baseUnit: "g", conversionFactor: "1000", packagingBottles: 1 },
  Box: { purchaseUnit: "box", baseUnit: "box", conversionFactor: "1", packagingBottles: 24 },
};

export function materialUnitRule(name: string, category?: string): MaterialUnitRule | null {
  const exact = UNIT_RULES[name];
  if (exact) return exact;
  if (category === "Pigment" || category === "Colour") return UNIT_RULES.Pigment;
  return null;
}

export function isControlledMaterialUnit(name: string, category: string, purchaseUnit: string, baseUnit: string, conversionFactor: string | number): boolean {
  const rule = materialUnitRule(name, category);
  if (!rule) return true;
  return rule.purchaseUnit === purchaseUnit && rule.baseUnit === baseUnit && rule.conversionFactor === String(conversionFactor);
}

export function baseQuantity(quantity: string | number, conversionFactor: string | number): string {
  return decimalMultiply(quantity, conversionFactor);
}
