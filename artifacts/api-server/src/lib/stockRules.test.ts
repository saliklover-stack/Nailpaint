import assert from "node:assert/strict";
import test from "node:test";
import { baseQuantity } from "./units";
import { grossProfit, netProfit, payable, receivable } from "./calculations";
import { assertSufficientStock, stockBalance, sumSalesInPeriod, type StockEntry } from "./stockRules";

test("20 L chemical purchase creates 20,000 ml base stock", () => {
  const entry: StockEntry = { quantityIn: baseQuantity("20", "1000"), quantityOut: "0", unit: "ml" };
  assert.equal(entry.quantityIn, "20000");
  assert.equal(stockBalance([entry]), "20000");
});

test("production consumes 5,000 ml and leaves 15,000 ml", () => {
  const entries: StockEntry[] = [
    { quantityIn: "20000", quantityOut: "0", unit: "ml" },
    { quantityIn: "0", quantityOut: "5000", unit: "ml" },
  ];
  assert.equal(stockBalance(entries), "15000");
});

test("production adds finished goods and sales reduce them", () => {
  const finishedGoods: StockEntry[] = [{ quantityIn: "100", quantityOut: "0", unit: "bottles" }];
  assert.equal(stockBalance(finishedGoods), "100");
  finishedGoods.push({ quantityIn: "0", quantityOut: "12", unit: "bottles" });
  assert.equal(stockBalance(finishedGoods), "88");
});

test("insufficient stock is rejected before posting", () => {
  const entries: StockEntry[] = [{ quantityIn: "10", quantityOut: "0", unit: "bottles" }];
  assert.throws(() => assertSufficientStock(stockBalance(entries), "11"), /Insufficient stock/);
  assert.equal(stockBalance(entries), "10");
});

test("customer receivables and supplier payables are exact", () => {
  assert.equal(receivable("100", "250.50", "50.50"), "300");
  assert.equal(payable("25.25", "100.75"), "126");
});

test("profit calculations are exact", () => {
  assert.equal(grossProfit("100.10", "20.05"), "80.05");
  assert.equal(netProfit("80.05", "10.05"), "70");
});

test("sales period filtering separates today and month totals", () => {
  const sales = [
    { date: "2026-09-23", revenue: "100.10" },
    { date: "2026-09-20", revenue: "50.05" },
    { date: "2026-08-31", revenue: "999.99" },
  ];
  assert.equal(sumSalesInPeriod(sales, "2026-09-23", "2026-09-23"), "100.1");
  assert.equal(sumSalesInPeriod(sales, "2026-09-01", "2026-09-23"), "150.15");
});
