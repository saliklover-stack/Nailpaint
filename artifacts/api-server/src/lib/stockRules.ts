import { decimalAdd, decimalCompare, decimalSubtract } from "./decimal";

export type StockEntry = {
  quantityIn: string;
  quantityOut: string;
  unit: string;
};

export function stockBalance(entries: StockEntry[]): string {
  return entries.reduce(
    (balance, entry) => decimalAdd(balance, decimalSubtract(entry.quantityIn, entry.quantityOut)),
    "0",
  );
}

export function assertSufficientStock(balance: string | number, quantityOut: string | number): void {
  if (decimalCompare(balance, quantityOut) < 0) {
    throw new Error(`Insufficient stock. Available: ${balance}. Required: ${quantityOut}.`);
  }
}

export function sumSalesInPeriod(sales: Array<{ date: string; revenue: string }>, from: string, to: string): string {
  return sales
    .filter((sale) => sale.date >= from && sale.date <= to)
    .reduce((total, sale) => decimalAdd(total, sale.revenue), "0");
}
