import {
  decimalAdd,
  decimalCompare,
  decimalDivide,
  decimalMultiply,
  decimalSubtract,
} from "./decimal";

export function weightedAverageCost(stock: string | number, averageCost: string | number, incomingQuantity: string | number, incomingCost: string | number): string {
  const oldValue = decimalMultiply(stock, averageCost);
  const totalQuantity = decimalAdd(stock, incomingQuantity);
  if (decimalCompare(totalQuantity, 0) === 0) return String(averageCost);
  return decimalDivide(decimalAdd(oldValue, incomingCost), totalQuantity);
}

export function productionLineCost(quantity: string | number, averageCost: string | number): string {
  return decimalMultiply(quantity, averageCost);
}

export function grossProfit(revenue: string | number, cogs: string | number): string {
  return decimalSubtract(revenue, cogs);
}

export function netProfit(gross: string | number, expenses: string | number): string {
  return decimalSubtract(gross, expenses);
}

export function receivable(openingBalance: string | number, outstandingSales: string | number, payments: string | number): string {
  return decimalSubtract(decimalAdd(openingBalance, outstandingSales), payments);
}

export function payable(openingBalance: string | number, purchases: string | number): string {
  return decimalAdd(openingBalance, purchases);
}
