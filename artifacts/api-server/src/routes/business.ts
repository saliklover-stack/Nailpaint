import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  customersTable,
  expensesTable,
  materialsTable,
  paymentsTable,
  productBomTable,
  productsTable,
  productionTable,
  purchasesTable,
  salesTable,
  stockTransactionsTable,
  suppliersTable,
} from "@workspace/db";
import {
  CheckProductionBody,
  CheckProductionResponse,
  CreateCustomerBody,
  CreateCustomerResponse,
  CreateExpenseBody,
  CreateExpenseResponse,
  CreateMaterialBody,
  CreateMaterialResponse,
  CreatePaymentBody,
  CreatePaymentResponse,
  CreateProductBody,
  CreateProductResponse,
  CreateProductionBody,
  CreateProductionResponse,
  CreatePurchaseBody,
  CreatePurchaseResponse,
  CreateSaleBody,
  CreateSaleResponse,
  CreateSupplierBody,
  CreateSupplierResponse,
  GetCustomersResponse,
  GetDashboardResponse,
  GetExpensesResponse,
  GetMaterialsQueryParams,
  GetMaterialsResponse,
  GetPaymentsResponse,
  GetProductsResponse,
  GetProductionsResponse,
  GetProfitLossQueryParams,
  GetProfitLossResponse,
  GetPurchasesResponse,
  GetSalesResponse,
  GetStockLedgerQueryParams,
  GetStockLedgerResponse,
  GetSuppliersResponse,
  UpdateProductBomBody,
  UpdateProductBomParams,
  UpdateProductBomResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

import {
  decimalAdd,
  decimalCompare,
  decimalDivide,
  decimalIsPositive,
  decimalMax,
  decimalMultiply,
  decimalSubtract,
  decimalToMoneyNumber,
  decimalToNumber,
} from "../lib/decimal";
import { grossProfit, netProfit, payable, receivable, weightedAverageCost } from "../lib/calculations";
import { baseQuantity as convertBaseQuantity, isControlledMaterialUnit, materialUnitRule } from "../lib/units";
import { assertActiveTransaction, TRANSACTION_STATUS, type TransactionStatus } from "../lib/transactionStatus";
const router: IRouter = Router();
const today = () => new Date().toISOString().slice(0, 10);
let seeded = false;

const asNumber = (value: unknown) => decimalToNumber(value as string | number | null | undefined);
const asMoneyNumber = (value: unknown) => decimalToMoneyNumber(value as string | number | null | undefined);
const dateValue = (value: Date | string) =>
  typeof value === "string" ? value : value.toISOString().slice(0, 10);

async function ensureSeed() {
  if (seeded) return;
  const [existing] = await db.select({ id: materialsTable.id }).from(materialsTable).limit(1);
  if (!existing) {
    const [chemical, brush, glass, cap, pigment] = await db
      .insert(materialsTable)
      .values([
        { name: "Chemical", category: "Base", purchaseUnit: "L", baseUnit: "ml", conversionFactor: "1000", minimumStock: "5000" },
        { name: "Brush", category: "Packaging", purchaseUnit: "pcs", baseUnit: "pcs", conversionFactor: "1", minimumStock: "100" },
        { name: "Glass bottle", category: "Packaging", purchaseUnit: "pcs", baseUnit: "pcs", conversionFactor: "1", minimumStock: "100" },
        { name: "Cap", category: "Packaging", purchaseUnit: "pcs", baseUnit: "pcs", conversionFactor: "1", minimumStock: "100" },
        { name: "Ruby Red Pigment", category: "Pigment", purchaseUnit: "kg", baseUnit: "g", conversionFactor: "1000", minimumStock: "500" },
        { name: "Box", category: "Packaging", purchaseUnit: "box", baseUnit: "box", conversionFactor: "1", minimumStock: "10", packagingBottles: 24 },
      ])
      .returning();
    const [product] = await db.insert(productsTable).values({
      sku: "RR-10",
      name: "Ruby Red 10 ml",
      colour: "Ruby red",
      bottleSize: "10",
      sellingPrice: "18",
      minimumStock: 100,
      averageCost: "0",
    }).returning();
    await db.insert(productBomTable).values([
      { productId: product.id, materialId: chemical.id, quantity: "10" },
      { productId: product.id, materialId: brush.id, quantity: "1" },
      { productId: product.id, materialId: glass.id, quantity: "1" },
      { productId: product.id, materialId: cap.id, quantity: "1" },
      { productId: product.id, materialId: pigment.id, quantity: "0.2" },
    ]);
    const [supplier] = await db.insert(suppliersTable).values({
      name: "Demo Packaging Supply",
      phone: "+966 50 000 0000",
      address: "Riyadh",
      paymentTerms: "Due on receipt",
    }).returning();
    await db.insert(customersTable).values({
      name: "Noor Beauty Studio",
      phone: "+966 55 000 0000",
      address: "Riyadh",
      creditLimit: "5000",
    });
    await db.insert(purchasesTable).values([
      { supplierId: supplier.id, materialId: chemical.id, quantity: "20", unit: "L", baseQuantity: "20000", price: "500", total: "500", date: today(), invoiceNumber: "DEMO-001" },
      { supplierId: supplier.id, materialId: brush.id, quantity: "1000", unit: "pcs", baseQuantity: "1000", price: "100", total: "100", date: today(), invoiceNumber: "DEMO-001" },
      { supplierId: supplier.id, materialId: glass.id, quantity: "1000", unit: "pcs", baseQuantity: "1000", price: "300", total: "300", date: today(), invoiceNumber: "DEMO-001" },
      { supplierId: supplier.id, materialId: cap.id, quantity: "1000", unit: "pcs", baseQuantity: "1000", price: "150", total: "150", date: today(), invoiceNumber: "DEMO-001" },
      { supplierId: supplier.id, materialId: pigment.id, quantity: "1", unit: "kg", baseQuantity: "1000", price: "200", total: "200", date: today(), invoiceNumber: "DEMO-001" },
    ]);
    const [purchaseRows] = await Promise.all([
      db.select().from(purchasesTable).where(eq(purchasesTable.invoiceNumber, "DEMO-001")),
    ]);
    await db.insert(stockTransactionsTable).values(purchaseRows.map((purchase) => ({
      itemType: "material",
      materialId: purchase.materialId,
      productId: null,
      quantityIn: purchase.baseQuantity,
      quantityOut: "0",
      unit: purchase.materialId === chemical.id ? "ml" : purchase.materialId === pigment.id ? "g" : purchase.unit,
      transactionType: "PURCHASE",
      referenceId: purchase.id,
      notes: "Demo opening stock",
    })));
    await db.update(materialsTable).set({ averageCost: "0.025" }).where(eq(materialsTable.id, chemical.id));
    await db.update(materialsTable).set({ averageCost: "0.1" }).where(eq(materialsTable.id, brush.id));
    await db.update(materialsTable).set({ averageCost: "0.3" }).where(eq(materialsTable.id, glass.id));
    await db.update(materialsTable).set({ averageCost: "0.15" }).where(eq(materialsTable.id, cap.id));
    await db.update(materialsTable).set({ averageCost: "0.2" }).where(eq(materialsTable.id, pigment.id));
  }
  seeded = true;
}

async function materialStock(materialId: number, executor: any = db) {
  const [row] = await executor
    .select({ stock: sql<number>`coalesce(sum(${stockTransactionsTable.quantityIn}) - sum(${stockTransactionsTable.quantityOut}), 0)` })
    .from(stockTransactionsTable)
    .where(eq(stockTransactionsTable.materialId, materialId));
  return String(row?.stock ?? "0");
}

async function productStock(productId: number, executor: any = db) {
  const [row] = await executor
    .select({ stock: sql<number>`coalesce(sum(${stockTransactionsTable.quantityIn}) - sum(${stockTransactionsTable.quantityOut}), 0)` })
    .from(stockTransactionsTable)
    .where(eq(stockTransactionsTable.productId, productId));
  return String(row?.stock ?? "0");
}

async function lockMaterial(materialId: number, executor: any): Promise<void> {
  await executor.execute(sql`select id from ${materialsTable} where id = ${materialId} for update`);
}

async function lockProduct(productId: number, executor: any): Promise<void> {
  await executor.execute(sql`select id from ${productsTable} where id = ${productId} for update`);
}

async function reverseStockRows(referenceId: number, transactionTypes: string[], reason: string, executor: any): Promise<void> {
  const rows = await executor.select().from(stockTransactionsTable).where(and(eq(stockTransactionsTable.referenceId, referenceId), sql`${stockTransactionsTable.transactionType} in (${sql.join(transactionTypes.map((type) => sql`${type}`), sql`, `)})`));
  for (const row of rows) {
    await executor.insert(stockTransactionsTable).values({
      itemType: row.itemType,
      materialId: row.materialId,
      productId: row.productId,
      quantityIn: row.quantityOut,
      quantityOut: row.quantityIn,
      unit: row.unit,
      transactionType: "REVERSAL",
      referenceId,
      reversalOfId: row.id,
      notes: `Reversal of stock movement #${row.id}: ${reason}`,
    });
  }
}

async function recalculateMaterialAverageCost(materialId: number, executor: any): Promise<void> {
  const rows = await executor.select({ quantity: purchasesTable.baseQuantity, cost: purchasesTable.total }).from(purchasesTable).where(and(eq(purchasesTable.materialId, materialId), eq(purchasesTable.status, TRANSACTION_STATUS.COMPLETED)));
  let quantity = "0";
  let value = "0";
  for (const row of rows) {
    quantity = decimalAdd(quantity, row.quantity);
    value = decimalAdd(value, row.cost);
  }
  await executor.update(materialsTable).set({ averageCost: decimalCompare(quantity, 0) === 0 ? "0" : decimalDivide(value, quantity) }).where(eq(materialsTable.id, materialId));
}

async function recalculateProductAverageCost(productId: number, executor: any): Promise<void> {
  const rows = await executor.select({ quantity: productionTable.quantity, cost: productionTable.totalCost }).from(productionTable).where(and(eq(productionTable.productId, productId), eq(productionTable.status, TRANSACTION_STATUS.COMPLETED)));
  let quantity = "0";
  let value = "0";
  for (const row of rows) {
    quantity = decimalAdd(quantity, row.quantity);
    value = decimalAdd(value, row.cost);
  }
  await executor.update(productsTable).set({ averageCost: decimalCompare(quantity, 0) === 0 ? "0" : decimalDivide(value, quantity) }).where(eq(productsTable.id, productId));
}

async function cancelPurchase(id: number, reason: string, executor: any, finalStatus: TransactionStatus = TRANSACTION_STATUS.CANCELLED): Promise<void> {
  const [purchase] = await executor.select().from(purchasesTable).where(eq(purchasesTable.id, id)).for("update");
  if (!purchase) throw new Error("Purchase not found");
  assertActiveTransaction(purchase.status);
  await lockMaterial(purchase.materialId, executor);
  if (decimalCompare(await materialStock(purchase.materialId, executor), purchase.baseQuantity) < 0) {
    throw new Error("Purchase cannot be cancelled because the material stock has already been consumed");
  }
  await reverseStockRows(id, ["PURCHASE"], reason, executor);
  await executor.update(purchasesTable).set({ status: finalStatus, cancelledAt: new Date(), reversalReason: reason }).where(eq(purchasesTable.id, id));
  await recalculateMaterialAverageCost(purchase.materialId, executor);
}

async function cancelProduction(id: number, reason: string, executor: any, finalStatus: TransactionStatus = TRANSACTION_STATUS.CANCELLED): Promise<void> {
  const [production] = await executor.select().from(productionTable).where(eq(productionTable.id, id)).for("update");
  if (!production) throw new Error("Production not found");
  assertActiveTransaction(production.status);
  await lockProduct(production.productId, executor);
  const outputStock = await productStock(production.productId, executor);
  if (decimalCompare(outputStock, production.quantity) < 0) {
    throw new Error("Production cannot be cancelled because finished stock has already been consumed");
  }
  const lines = await executor.select().from(productBomTable).where(eq(productBomTable.productId, production.productId));
  for (const line of lines) await lockMaterial(line.materialId, executor);
  await reverseStockRows(id, ["PRODUCTION_CONSUMPTION", "PRODUCTION_OUTPUT"], reason, executor);
  await executor.update(productionTable).set({ status: finalStatus, cancelledAt: new Date(), reversalReason: reason }).where(eq(productionTable.id, id));
  await recalculateProductAverageCost(production.productId, executor);
}

async function cancelSale(id: number, reason: string, executor: any, finalStatus: TransactionStatus = TRANSACTION_STATUS.CANCELLED): Promise<void> {
  const [sale] = await executor.select().from(salesTable).where(eq(salesTable.id, id)).for("update");
  if (!sale) throw new Error("Sale not found");
  assertActiveTransaction(sale.status);
  await lockProduct(sale.productId, executor);
  await reverseStockRows(id, ["SALE"], reason, executor);
  await executor.update(paymentsTable).set({ status: finalStatus, cancelledAt: new Date(), reversalReason: reason }).where(and(eq(paymentsTable.status, TRANSACTION_STATUS.COMPLETED), sql`${paymentsTable.notes} = ${`Payment for sale #${id}`}`));
  await executor.update(salesTable).set({ status: finalStatus, cancelledAt: new Date(), reversalReason: reason }).where(eq(salesTable.id, id));
}

async function cancelPayment(id: number, reason: string, executor: any, finalStatus: TransactionStatus = TRANSACTION_STATUS.CANCELLED): Promise<void> {
  const [payment] = await executor.select().from(paymentsTable).where(eq(paymentsTable.id, id)).for("update");
  if (!payment) throw new Error("Payment not found");
  assertActiveTransaction(payment.status);
  await executor.update(paymentsTable).set({ status: finalStatus, cancelledAt: new Date(), reversalReason: reason }).where(eq(paymentsTable.id, id));
}

async function cancelExpense(id: number, reason: string, executor: any, finalStatus: TransactionStatus = TRANSACTION_STATUS.CANCELLED): Promise<void> {
  const [expense] = await executor.select().from(expensesTable).where(eq(expensesTable.id, id)).for("update");
  if (!expense) throw new Error("Expense not found");
  assertActiveTransaction(expense.status);
  await executor.update(expensesTable).set({ status: finalStatus, cancelledAt: new Date(), reversalReason: reason }).where(eq(expensesTable.id, id));
}

async function materialView(material: typeof materialsTable.$inferSelect, executor: any = db) {
  return {
    id: material.id,
    name: material.name,
    category: material.category,
    purchaseUnit: material.purchaseUnit,
    baseUnit: material.baseUnit,
    conversionFactor: asNumber(material.conversionFactor),
    minimumStock: asNumber(material.minimumStock),
    currentStock: asNumber(await materialStock(material.id, executor)),
    averageCost: asMoneyNumber(material.averageCost),
    packagingBottles: material.packagingBottles,
    active: material.active,
  };
}

async function productView(product: typeof productsTable.$inferSelect, executor: any = db) {
  const lines = await executor
    .select({ materialId: productBomTable.materialId, materialName: materialsTable.name, quantity: productBomTable.quantity, unit: materialsTable.baseUnit })
    .from(productBomTable)
    .innerJoin(materialsTable, eq(productBomTable.materialId, materialsTable.id))
    .where(eq(productBomTable.productId, product.id));
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    colour: product.colour,
    bottleSize: asNumber(product.bottleSize),
    sellingPrice: asMoneyNumber(product.sellingPrice),
    minimumStock: product.minimumStock,
    currentStock: Math.round(asNumber(await productStock(product.id, executor))),
    averageCost: asMoneyNumber(product.averageCost),
    active: product.active,
    bom: lines,
  };
}

async function productionCheck(productId: number, quantity: number, executor: any = db) {
  const [product] = await executor.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) return null;
  const lines = await executor
    .select({ materialId: productBomTable.materialId, materialName: materialsTable.name, bomQuantity: productBomTable.quantity, unit: materialsTable.baseUnit, averageCost: materialsTable.averageCost })
    .from(productBomTable)
    .innerJoin(materialsTable, eq(productBomTable.materialId, materialsTable.id))
    .where(eq(productBomTable.productId, productId));
  const requirements = await Promise.all((lines as Array<{
    materialId: number;
    materialName: string;
    bomQuantity: string;
    unit: string;
    averageCost: string;
  }>).map(async (line) => {
    const required = decimalMultiply(line.bomQuantity, quantity);
    const available = await materialStock(line.materialId, executor);
    return {
      materialId: line.materialId,
      materialName: line.materialName,
      unit: line.unit,
      required: asNumber(required),
      available: asNumber(available),
      shortage: asNumber(decimalCompare(required, available) > 0 ? decimalSubtract(required, available) : "0"),
      cost: decimalMultiply(required, line.averageCost),
    };
  }));
  const totalCost = requirements.reduce((sum, line) => decimalAdd(sum, line.cost), "0");
  const estimatedUnitCostDecimal = quantity ? decimalDivide(totalCost, quantity) : "0";
  return {
    canProduce: requirements.every((line) => line.shortage <= 0),
    productName: product.name,
    quantity,
    estimatedUnitCost: asMoneyNumber(estimatedUnitCostDecimal),
    estimatedUnitCostDecimal,
    requirements: requirements.map(({ cost: _cost, ...line }) => line),
  };
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  await ensureSeed();
  const currentDate = today();
  const monthStart = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}-01`;
  const [todayTotals] = await db.select({ revenue: sql<string>`coalesce(sum(${salesTable.revenue}), 0)` })
    .from(salesTable).where(and(eq(salesTable.date, currentDate), eq(salesTable.status, TRANSACTION_STATUS.COMPLETED)));
  const [monthTotals] = await db.select({
    revenue: sql<string>`coalesce(sum(${salesTable.revenue}), 0)`,
    grossProfit: sql<string>`coalesce(sum(${salesTable.grossProfit}), 0)`,
    productsSold: sql<number>`coalesce(sum(${salesTable.quantity}), 0)`,
  }).from(salesTable).where(and(sql`${salesTable.date} >= ${monthStart}`, sql`${salesTable.date} <= ${currentDate}`, eq(salesTable.status, TRANSACTION_STATUS.COMPLETED)));
  const [expenseTotals] = await db.select({ total: sql<string>`coalesce(sum(${expensesTable.amount}), 0)` }).from(expensesTable)
    .where(and(sql`${expensesTable.date} >= ${monthStart}`, sql`${expensesTable.date} <= ${currentDate}`, eq(expensesTable.status, TRANSACTION_STATUS.COMPLETED)));
  const materials = await Promise.all((await db.select().from(materialsTable).where(eq(materialsTable.active, true))).map((row) => materialView(row)));
  const products = await Promise.all((await db.select().from(productsTable).where(eq(productsTable.active, true))).map((row) => productView(row)));
  const recentSales = await db.select({ id: salesTable.id, revenue: salesTable.revenue, date: salesTable.date, productName: productsTable.name }).from(salesTable).innerJoin(productsTable, eq(salesTable.productId, productsTable.id)).where(eq(salesTable.status, TRANSACTION_STATUS.COMPLETED)).orderBy(desc(salesTable.id)).limit(5);
  const recentPurchases = await db.select({ id: purchasesTable.id, total: purchasesTable.total, date: purchasesTable.date, materialName: materialsTable.name }).from(purchasesTable).innerJoin(materialsTable, eq(purchasesTable.materialId, materialsTable.id)).where(eq(purchasesTable.status, TRANSACTION_STATUS.COMPLETED)).orderBy(desc(purchasesTable.id)).limit(5);
  const dashboard = {
    todaySales: asMoneyNumber(todayTotals?.revenue),
    monthSales: asMoneyNumber(monthTotals?.revenue),
    productsSold: Math.round(asNumber(monthTotals?.productsSold)),
    grossProfit: asMoneyNumber(monthTotals?.grossProfit),
    netProfit: asMoneyNumber(netProfit(monthTotals?.grossProfit, expenseTotals?.total)),
    expenses: asMoneyNumber(expenseTotals?.total),
    rawMaterialValue: asMoneyNumber(materials.reduce((sum, material) => decimalAdd(sum, decimalMultiply(material.currentStock, material.averageCost)), "0")),
    finishedStockValue: asMoneyNumber(products.reduce((sum, product) => decimalAdd(sum, decimalMultiply(product.currentStock, product.averageCost)), "0")),
    customerReceivables: asMoneyNumber(receivable(
      (await db.select({ total: sql<string>`coalesce(sum(${customersTable.openingBalance}), 0)` }).from(customersTable))[0]?.total,
      (await db.select({ total: sql<string>`coalesce(sum(${salesTable.balanceDue}), 0)` }).from(salesTable).where(eq(salesTable.status, TRANSACTION_STATUS.COMPLETED)))[0]?.total,
      (await db.select({ total: sql<string>`coalesce(sum(${paymentsTable.amount}), 0)` }).from(paymentsTable).where(eq(paymentsTable.status, TRANSACTION_STATUS.COMPLETED)))[0]?.total,
    )),
    supplierPayables: asMoneyNumber(payable(
      (await db.select({ total: sql<string>`coalesce(sum(${suppliersTable.openingBalance}), 0)` }).from(suppliersTable))[0]?.total,
      (await db.select({ total: sql<string>`coalesce(sum(${purchasesTable.total}), 0)` }).from(purchasesTable).where(eq(purchasesTable.status, TRANSACTION_STATUS.COMPLETED)))[0]?.total,
    )),
    lowStockMaterials: materials.filter((material) => material.currentStock <= material.minimumStock),
    lowStockProducts: products.filter((product) => product.currentStock <= product.minimumStock),
    recentActivity: [
      ...recentSales.map((item) => ({ type: "SALE", label: item.productName, amount: asMoneyNumber(item.revenue), date: new Date(`${item.date}T12:00:00Z`).toISOString() })),
      ...recentPurchases.map((item) => ({ type: "PURCHASE", label: item.materialName, amount: asMoneyNumber(item.total), date: new Date(`${item.date}T12:00:00Z`).toISOString() })),
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
  };
  res.json(GetDashboardResponse.parse(dashboard));
});

router.get("/materials", async (req, res): Promise<void> => {
  await ensureSeed();
  const parsed = GetMaterialsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const conditions = [eq(materialsTable.active, parsed.data.active ?? true)];
  if (parsed.data.search) conditions.push(or(ilike(materialsTable.name, `%${parsed.data.search}%`), ilike(materialsTable.category, `%${parsed.data.search}%`))!);
  const rows = await db.select().from(materialsTable).where(and(...conditions));
  res.json(GetMaterialsResponse.parse(await Promise.all(rows.map((row) => materialView(row)))));
});

router.post("/materials", async (req, res): Promise<void> => {
  const parsed = CreateMaterialBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!isControlledMaterialUnit(parsed.data.name, parsed.data.category, parsed.data.purchaseUnit, parsed.data.baseUnit, parsed.data.conversionFactor)) {
    res.status(400).json({ error: "Material units do not match the controlled unit definition" });
    return;
  }
  const rule = materialUnitRule(parsed.data.name, parsed.data.category);
  const [row] = await db.insert(materialsTable).values({
    ...parsed.data,
    conversionFactor: String(parsed.data.conversionFactor),
    minimumStock: String(parsed.data.minimumStock),
    packagingBottles: rule?.packagingBottles ?? 1,
  }).returning();
  res.status(201).json(CreateMaterialResponse.parse(await materialView(row)));
});

router.get("/suppliers", async (_req, res): Promise<void> => {
  await ensureSeed();
  const rows = await db.select().from(suppliersTable).orderBy(suppliersTable.name);
  const output = await Promise.all(rows.map(async (row) => {
    const [purchases] = await db.select({ total: sql<number>`coalesce(sum(${purchasesTable.total}), 0)` }).from(purchasesTable).where(and(eq(purchasesTable.supplierId, row.id), eq(purchasesTable.status, TRANSACTION_STATUS.COMPLETED)));
    return { ...row, openingBalance: asMoneyNumber(row.openingBalance), outstandingBalance: asMoneyNumber(payable(row.openingBalance, purchases?.total)) };
  }));
  res.json(GetSuppliersResponse.parse(output));
});

router.post("/suppliers", async (req, res): Promise<void> => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(suppliersTable).values({ ...parsed.data, openingBalance: String(parsed.data.openingBalance ?? 0) }).returning();
  res.status(201).json(CreateSupplierResponse.parse({ ...row, openingBalance: asMoneyNumber(row.openingBalance), outstandingBalance: asMoneyNumber(row.openingBalance) }));
});

router.get("/purchases", async (_req, res): Promise<void> => {
  await ensureSeed();
  const rows = await db.select({
    id: purchasesTable.id, supplierId: suppliersTable.id, supplierName: suppliersTable.name,
    materialId: materialsTable.id, materialName: materialsTable.name, quantity: purchasesTable.quantity,
    unit: purchasesTable.unit, baseQuantity: purchasesTable.baseQuantity, price: purchasesTable.price,
    total: purchasesTable.total, date: purchasesTable.date, invoiceNumber: purchasesTable.invoiceNumber, notes: purchasesTable.notes,
    status: purchasesTable.status, cancelledAt: purchasesTable.cancelledAt, reversalReason: purchasesTable.reversalReason, reversalOfId: purchasesTable.reversalOfId,
  }).from(purchasesTable).innerJoin(suppliersTable, eq(purchasesTable.supplierId, suppliersTable.id)).innerJoin(materialsTable, eq(purchasesTable.materialId, materialsTable.id)).orderBy(desc(purchasesTable.id));
  res.json(GetPurchasesResponse.parse(rows.map((row) => ({
    ...row,
    quantity: asNumber(row.quantity),
    baseQuantity: asNumber(row.baseQuantity),
    price: asMoneyNumber(row.price),
    total: asMoneyNumber(row.total),
  }))));
});

router.post("/purchases", async (req, res): Promise<void> => {
  const parsed = CreatePurchaseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const result = await db.transaction(async (tx) => {
    const [material] = await tx.select().from(materialsTable).where(eq(materialsTable.id, parsed.data.materialId));
    if (!material) throw new Error("Material not found");
    await lockMaterial(material.id, tx);
    const baseQuantity = convertBaseQuantity(parsed.data.quantity, material.conversionFactor);
    const [purchase] = await tx.insert(purchasesTable).values({
      supplierId: parsed.data.supplierId,
      materialId: parsed.data.materialId,
      quantity: String(parsed.data.quantity),
      unit: material.purchaseUnit,
      baseQuantity,
      total: String(parsed.data.price),
      price: String(parsed.data.price),
      date: dateValue(parsed.data.date),
      invoiceNumber: parsed.data.invoiceNumber ?? "",
      notes: parsed.data.notes ?? "",
    }).returning();
    const oldStock = await materialStock(material.id, tx);
    const newCost = weightedAverageCost(oldStock, material.averageCost, baseQuantity, parsed.data.price);
    await tx.update(materialsTable).set({ averageCost: newCost }).where(eq(materialsTable.id, material.id));
    await tx.insert(stockTransactionsTable).values({
      itemType: "material", materialId: material.id, productId: null, quantityIn: baseQuantity, quantityOut: "0",
      unit: material.baseUnit, transactionType: "PURCHASE", referenceId: purchase.id, notes: `Base quantity: ${baseQuantity} ${material.baseUnit}. ${parsed.data.notes ?? ""}`,
    });
    return purchase;
  });
  const [row] = await db.select({
    id: purchasesTable.id, supplierId: suppliersTable.id, supplierName: suppliersTable.name,
    materialId: materialsTable.id, materialName: materialsTable.name, quantity: purchasesTable.quantity,
    unit: purchasesTable.unit, baseQuantity: purchasesTable.baseQuantity, price: purchasesTable.price,
    total: purchasesTable.total, date: purchasesTable.date, invoiceNumber: purchasesTable.invoiceNumber, notes: purchasesTable.notes,
    status: purchasesTable.status, cancelledAt: purchasesTable.cancelledAt, reversalReason: purchasesTable.reversalReason, reversalOfId: purchasesTable.reversalOfId,
  }).from(purchasesTable).innerJoin(suppliersTable, eq(purchasesTable.supplierId, suppliersTable.id)).innerJoin(materialsTable, eq(purchasesTable.materialId, materialsTable.id)).where(eq(purchasesTable.id, result.id));
  res.status(201).json(CreatePurchaseResponse.parse({
    ...row,
    quantity: asNumber(row.quantity),
    baseQuantity: asNumber(row.baseQuantity),
    price: asMoneyNumber(row.price),
    total: asMoneyNumber(row.total),
  }));
});

router.post("/purchases/:id/cancel", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!Number.isInteger(id) || !reason) { res.status(400).json({ error: "A transaction id and cancellation reason are required" }); return; }
  await db.transaction(async (tx) => cancelPurchase(id, reason, tx));
  res.json({ id, status: TRANSACTION_STATUS.CANCELLED, reason });
});

router.put("/purchases/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = CreatePurchaseBody.partial().safeParse(req.body);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "Edited transaction";
  if (!Number.isInteger(id) || !parsed.success) { res.status(400).json({ error: "Invalid purchase edit" }); return; }
  const result = await db.transaction(async (tx) => {
    const [original] = await tx.select().from(purchasesTable).where(eq(purchasesTable.id, id));
    if (!original) throw new Error("Purchase not found");
    const purchaseData = { supplierId: parsed.data.supplierId ?? original.supplierId, materialId: parsed.data.materialId ?? original.materialId, quantity: parsed.data.quantity ?? Number(original.quantity), price: parsed.data.price ?? Number(original.price), date: parsed.data.date ?? new Date(`${original.date}T00:00:00Z`), invoiceNumber: parsed.data.invoiceNumber ?? original.invoiceNumber, notes: parsed.data.notes ?? original.notes };
    await cancelPurchase(id, reason, tx, TRANSACTION_STATUS.REVERSED);
    const [material] = await tx.select().from(materialsTable).where(eq(materialsTable.id, purchaseData.materialId));
    if (!material) throw new Error("Material not found");
    await lockMaterial(material.id, tx);
    const converted = convertBaseQuantity(purchaseData.quantity, material.conversionFactor);
    const [purchase] = await tx.insert(purchasesTable).values({
      supplierId: purchaseData.supplierId, materialId: purchaseData.materialId,
      quantity: String(purchaseData.quantity), unit: material.purchaseUnit, baseQuantity: converted,
      price: String(purchaseData.price), total: String(purchaseData.price), date: dateValue(purchaseData.date),
      invoiceNumber: purchaseData.invoiceNumber, notes: purchaseData.notes, reversalOfId: id,
    }).returning();
    await tx.insert(stockTransactionsTable).values({ itemType: "material", materialId: material.id, productId: null, quantityIn: converted, quantityOut: "0", unit: material.baseUnit, transactionType: "PURCHASE", referenceId: purchase.id, notes: `Edited purchase replacing #${id}` });
    await recalculateMaterialAverageCost(material.id, tx);
    return purchase;
  });
  res.status(200).json({ id: result.id, status: TRANSACTION_STATUS.COMPLETED, reversalOfId: id });
});

router.get("/products", async (_req, res): Promise<void> => {
  await ensureSeed();
  const rows = await db.select().from(productsTable).orderBy(productsTable.name);
  res.json(GetProductsResponse.parse(await Promise.all(rows.map((row) => productView(row)))));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(productsTable).values({
    ...parsed.data,
    bottleSize: String(parsed.data.bottleSize),
    sellingPrice: String(parsed.data.sellingPrice ?? 0),
    averageCost: "0",
  }).returning();
  res.status(201).json(CreateProductResponse.parse(await productView(row)));
});

router.put("/products/:id/bom", async (req, res): Promise<void> => {
  const params = UpdateProductBomParams.safeParse(req.params);
  const parsed = UpdateProductBomBody.safeParse(req.body);
  if (!params.success || !parsed.success) { res.status(400).json({ error: "Invalid recipe" }); return; }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  await db.transaction(async (tx) => {
    await tx.delete(productBomTable).where(eq(productBomTable.productId, product.id));
    if (parsed.data.lines.length) await tx.insert(productBomTable).values(parsed.data.lines.map((line) => ({ productId: product.id, ...line, quantity: String(line.quantity) })));
  });
  res.json(UpdateProductBomResponse.parse(await productView(product)));
});

router.post("/production/check", async (req, res): Promise<void> => {
  const parsed = CheckProductionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const check = await productionCheck(parsed.data.productId, parsed.data.quantity);
  if (!check) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(CheckProductionResponse.parse(check));
});

router.get("/production", async (_req, res): Promise<void> => {
  await ensureSeed();
  const rows = await db.select({ id: productionTable.id, productId: productsTable.id, productName: productsTable.name, quantity: productionTable.quantity, unitCost: productionTable.unitCost, totalCost: productionTable.totalCost, date: productionTable.date, status: productionTable.status, cancelledAt: productionTable.cancelledAt, reversalReason: productionTable.reversalReason, reversalOfId: productionTable.reversalOfId }).from(productionTable).innerJoin(productsTable, eq(productionTable.productId, productsTable.id)).orderBy(desc(productionTable.id));
  res.json(GetProductionsResponse.parse(rows.map((row) => ({
    ...row,
    unitCost: asMoneyNumber(row.unitCost),
    totalCost: asMoneyNumber(row.totalCost),
  }))));
});

router.post("/production", async (req, res): Promise<void> => {
  const parsed = CreateProductionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const result = await db.transaction(async (tx) => {
    await lockProduct(parsed.data.productId, tx);
    const bomLines = await tx.select().from(productBomTable).where(eq(productBomTable.productId, parsed.data.productId));
    for (const line of bomLines.sort((left, right) => left.materialId - right.materialId)) {
      await lockMaterial(line.materialId, tx);
    }
    const check = await productionCheck(parsed.data.productId, parsed.data.quantity, tx);
    if (!check) throw new Error("Product not found");
    if (!check.canProduce) {
      const shortage = check.requirements.find((line) => line.shortage > 0);
      throw new Error(`Insufficient ${shortage?.materialName ?? "material"} stock. Required: ${shortage?.required ?? 0} ${shortage?.unit ?? ""}. Available: ${shortage?.available ?? 0} ${shortage?.unit ?? ""}.`);
    }
    const [production] = await tx.insert(productionTable).values({
      productId: parsed.data.productId, quantity: parsed.data.quantity, unitCost: check.estimatedUnitCostDecimal,
      totalCost: decimalMultiply(check.estimatedUnitCostDecimal, parsed.data.quantity), date: dateValue(parsed.data.date),
    }).returning();
    for (const line of bomLines) {
      const material = (await tx.select().from(materialsTable).where(eq(materialsTable.id, line.materialId)))[0];
      await tx.insert(stockTransactionsTable).values({
        itemType: "material", materialId: line.materialId, productId: null, quantityIn: "0",
        quantityOut: decimalMultiply(line.quantity, parsed.data.quantity), unit: material.baseUnit, transactionType: "PRODUCTION_CONSUMPTION", referenceId: production.id, notes: `Production #${production.id}`,
      });
    }
    await tx.insert(stockTransactionsTable).values({
      itemType: "product", materialId: null, productId: parsed.data.productId, quantityIn: String(parsed.data.quantity),
      quantityOut: "0", unit: "bottles", transactionType: "PRODUCTION_OUTPUT", referenceId: production.id, notes: `Production #${production.id}`,
    });
    await tx.update(productsTable).set({ averageCost: check.estimatedUnitCostDecimal }).where(eq(productsTable.id, parsed.data.productId));
    return production;
  });
  const [row] = await db.select({ id: productionTable.id, productId: productsTable.id, productName: productsTable.name, quantity: productionTable.quantity, unitCost: productionTable.unitCost, totalCost: productionTable.totalCost, date: productionTable.date, status: productionTable.status, cancelledAt: productionTable.cancelledAt, reversalReason: productionTable.reversalReason, reversalOfId: productionTable.reversalOfId }).from(productionTable).innerJoin(productsTable, eq(productionTable.productId, productsTable.id)).where(eq(productionTable.id, result.id));
  res.status(201).json(CreateProductionResponse.parse({
    ...row,
    unitCost: asMoneyNumber(row.unitCost),
    totalCost: asMoneyNumber(row.totalCost),
  }));
});

router.post("/production/:id/cancel", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!Number.isInteger(id) || !reason) { res.status(400).json({ error: "A transaction id and cancellation reason are required" }); return; }
  await db.transaction(async (tx) => cancelProduction(id, reason, tx));
  res.json({ id, status: TRANSACTION_STATUS.CANCELLED, reason });
});

router.put("/production/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = CreateProductionBody.partial().safeParse(req.body);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "Edited transaction";
  if (!Number.isInteger(id) || !parsed.success) { res.status(400).json({ error: "Invalid production edit" }); return; }
  const result = await db.transaction(async (tx) => {
    const [original] = await tx.select().from(productionTable).where(eq(productionTable.id, id));
    if (!original) throw new Error("Production not found");
    const productionData = { productId: parsed.data.productId ?? original.productId, quantity: parsed.data.quantity ?? original.quantity, date: parsed.data.date ?? new Date(`${original.date}T00:00:00Z`) };
    await cancelProduction(id, reason, tx, TRANSACTION_STATUS.REVERSED);
    await lockProduct(productionData.productId, tx);
    const bomLines = await tx.select().from(productBomTable).where(eq(productBomTable.productId, productionData.productId));
    for (const line of bomLines.sort((left, right) => left.materialId - right.materialId)) await lockMaterial(line.materialId, tx);
    const check = await productionCheck(productionData.productId, productionData.quantity, tx);
    if (!check) throw new Error("Product not found");
    if (!check.canProduce) throw new Error("Insufficient material stock for edited production");
    const [production] = await tx.insert(productionTable).values({
      productId: productionData.productId, quantity: productionData.quantity,
      unitCost: check.estimatedUnitCostDecimal, totalCost: decimalMultiply(check.estimatedUnitCostDecimal, productionData.quantity),
      date: dateValue(productionData.date), reversalOfId: id,
    }).returning();
    for (const line of bomLines) {
      const [material] = await tx.select().from(materialsTable).where(eq(materialsTable.id, line.materialId));
      await tx.insert(stockTransactionsTable).values({ itemType: "material", materialId: line.materialId, productId: null, quantityIn: "0", quantityOut: decimalMultiply(line.quantity, productionData.quantity), unit: material.baseUnit, transactionType: "PRODUCTION_CONSUMPTION", referenceId: production.id, notes: `Edited production replacing #${id}` });
    }
    await tx.insert(stockTransactionsTable).values({ itemType: "product", materialId: null, productId: productionData.productId, quantityIn: String(productionData.quantity), quantityOut: "0", unit: "bottles", transactionType: "PRODUCTION_OUTPUT", referenceId: production.id, notes: `Edited production replacing #${id}` });
    await recalculateProductAverageCost(productionData.productId, tx);
    return production;
  });
  res.status(200).json({ id: result.id, status: TRANSACTION_STATUS.COMPLETED, reversalOfId: id });
});

router.get("/customers", async (_req, res): Promise<void> => {
  await ensureSeed();
  const rows = await db.select().from(customersTable).orderBy(customersTable.name);
  const output = await Promise.all(rows.map(async (row) => {
    const [sales] = await db.select({ total: sql<number>`coalesce(sum(${salesTable.balanceDue}), 0)` }).from(salesTable).where(and(eq(salesTable.customerId, row.id), eq(salesTable.status, TRANSACTION_STATUS.COMPLETED)));
    const [payments] = await db.select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)` }).from(paymentsTable).where(and(eq(paymentsTable.customerId, row.id), eq(paymentsTable.status, TRANSACTION_STATUS.COMPLETED)));
    return {
      ...row,
      openingBalance: asMoneyNumber(row.openingBalance),
      creditLimit: asMoneyNumber(row.creditLimit),
      outstandingBalance: asMoneyNumber(receivable(row.openingBalance, sales?.total, payments?.total)),
    };
  }));
  res.json(GetCustomersResponse.parse(output));
});

router.post("/customers", async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(customersTable).values({
    ...parsed.data,
    openingBalance: String(parsed.data.openingBalance ?? 0),
    creditLimit: String(parsed.data.creditLimit),
  }).returning();
  res.status(201).json(CreateCustomerResponse.parse({
    ...row,
    openingBalance: asMoneyNumber(row.openingBalance),
    creditLimit: asMoneyNumber(row.creditLimit),
    outstandingBalance: asMoneyNumber(row.openingBalance),
  }));
});

router.get("/sales", async (_req, res): Promise<void> => {
  await ensureSeed();
  const rows = await db.select({ id: salesTable.id, customerId: customersTable.id, customerName: customersTable.name, productId: productsTable.id, productName: productsTable.name, quantity: salesTable.quantity, sellingPrice: salesTable.sellingPrice, revenue: salesTable.revenue, cogs: salesTable.cogs, grossProfit: salesTable.grossProfit, paymentMethod: salesTable.paymentMethod, paidAmount: salesTable.paidAmount, balanceDue: salesTable.balanceDue, date: salesTable.date, status: salesTable.status, cancelledAt: salesTable.cancelledAt, reversalReason: salesTable.reversalReason, reversalOfId: salesTable.reversalOfId }).from(salesTable).innerJoin(customersTable, eq(salesTable.customerId, customersTable.id)).innerJoin(productsTable, eq(salesTable.productId, productsTable.id)).orderBy(desc(salesTable.id));
  res.json(GetSalesResponse.parse(rows.map((row) => ({
    ...row,
    sellingPrice: asMoneyNumber(row.sellingPrice),
    revenue: asMoneyNumber(row.revenue),
    cogs: asMoneyNumber(row.cogs),
    grossProfit: asMoneyNumber(row.grossProfit),
    paidAmount: asMoneyNumber(row.paidAmount),
    balanceDue: asMoneyNumber(row.balanceDue),
  }))));
});

router.post("/sales", async (req, res): Promise<void> => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const result = await db.transaction(async (tx) => {
    const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, parsed.data.productId));
    if (!product) throw new Error("Product not found");
    const [customer] = await tx.select().from(customersTable).where(eq(customersTable.id, parsed.data.customerId));
    if (!customer) throw new Error("Customer not found");
    await lockProduct(product.id, tx);
    const stock = await productStock(product.id, tx);
    if (decimalCompare(stock, parsed.data.quantity) < 0) throw new Error(`Sale cannot be completed because finished stock is insufficient. Available: ${asNumber(stock)} bottles.`);
    const sellingPrice = parsed.data.sellingPrice ?? product.sellingPrice;
    const revenue = decimalMultiply(sellingPrice, parsed.data.quantity);
    const cogs = decimalMultiply(product.averageCost, parsed.data.quantity);
    const requestedPaid = parsed.data.paidAmount ?? 0;
    const paidAmount = decimalCompare(requestedPaid, revenue) > 0 ? revenue : String(requestedPaid);
    const [sale] = await tx.insert(salesTable).values({
      customerId: parsed.data.customerId, productId: product.id, quantity: parsed.data.quantity,
      sellingPrice: String(sellingPrice), revenue, cogs, grossProfit: grossProfit(revenue, cogs), paymentMethod: parsed.data.paymentMethod,
      paidAmount, balanceDue: decimalSubtract(revenue, paidAmount), date: dateValue(parsed.data.date),
    }).returning();
    await tx.insert(stockTransactionsTable).values({
      itemType: "product", materialId: null, productId: product.id, quantityIn: "0", quantityOut: String(parsed.data.quantity),
      unit: "bottles", transactionType: "SALE", referenceId: sale.id, notes: `Sale #${sale.id}`,
    });
    if (decimalIsPositive(paidAmount)) await tx.insert(paymentsTable).values({ customerId: customer.id, amount: paidAmount, method: parsed.data.paymentMethod, date: dateValue(parsed.data.date), notes: `Payment for sale #${sale.id}` });
    return sale;
  });
  const [row] = await db.select({ id: salesTable.id, customerId: customersTable.id, customerName: customersTable.name, productId: productsTable.id, productName: productsTable.name, quantity: salesTable.quantity, sellingPrice: salesTable.sellingPrice, revenue: salesTable.revenue, cogs: salesTable.cogs, grossProfit: salesTable.grossProfit, paymentMethod: salesTable.paymentMethod, paidAmount: salesTable.paidAmount, balanceDue: salesTable.balanceDue, date: salesTable.date, status: salesTable.status, cancelledAt: salesTable.cancelledAt, reversalReason: salesTable.reversalReason, reversalOfId: salesTable.reversalOfId }).from(salesTable).innerJoin(customersTable, eq(salesTable.customerId, customersTable.id)).innerJoin(productsTable, eq(salesTable.productId, productsTable.id)).where(eq(salesTable.id, result.id));
  res.status(201).json(CreateSaleResponse.parse({
    ...row,
    sellingPrice: asMoneyNumber(row.sellingPrice),
    revenue: asMoneyNumber(row.revenue),
    cogs: asMoneyNumber(row.cogs),
    grossProfit: asMoneyNumber(row.grossProfit),
    paidAmount: asMoneyNumber(row.paidAmount),
    balanceDue: asMoneyNumber(row.balanceDue),
  }));
});

router.post("/sales/:id/cancel", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!Number.isInteger(id) || !reason) { res.status(400).json({ error: "A transaction id and cancellation reason are required" }); return; }
  await db.transaction(async (tx) => cancelSale(id, reason, tx));
  res.json({ id, status: TRANSACTION_STATUS.CANCELLED, reason });
});

router.put("/sales/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = CreateSaleBody.partial().safeParse(req.body);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "Edited transaction";
  if (!Number.isInteger(id) || !parsed.success) { res.status(400).json({ error: "Invalid sale edit" }); return; }
  const result = await db.transaction(async (tx) => {
    const [original] = await tx.select().from(salesTable).where(eq(salesTable.id, id));
    if (!original) throw new Error("Sale not found");
    const saleData = { customerId: parsed.data.customerId ?? original.customerId, productId: parsed.data.productId ?? original.productId, quantity: parsed.data.quantity ?? original.quantity, sellingPrice: parsed.data.sellingPrice ?? Number(original.sellingPrice), paymentMethod: parsed.data.paymentMethod ?? original.paymentMethod, paidAmount: parsed.data.paidAmount ?? Number(original.paidAmount), date: parsed.data.date ?? new Date(`${original.date}T00:00:00Z`) };
    await cancelSale(id, reason, tx, TRANSACTION_STATUS.REVERSED);
    const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, saleData.productId));
    if (!product) throw new Error("Product not found");
    const [customer] = await tx.select().from(customersTable).where(eq(customersTable.id, saleData.customerId));
    if (!customer) throw new Error("Customer not found");
    await lockProduct(product.id, tx);
    const stock = await productStock(product.id, tx);
    if (decimalCompare(stock, saleData.quantity) < 0) throw new Error("Sale cannot be completed because finished stock is insufficient");
    const sellingPrice = saleData.sellingPrice ?? product.sellingPrice;
    const revenue = decimalMultiply(sellingPrice, saleData.quantity);
    const cogs = decimalMultiply(product.averageCost, saleData.quantity);
    const paidAmount = decimalCompare(saleData.paidAmount ?? 0, revenue) > 0 ? revenue : String(saleData.paidAmount ?? 0);
    const [sale] = await tx.insert(salesTable).values({
      customerId: customer.id, productId: product.id, quantity: saleData.quantity,
      sellingPrice: String(sellingPrice), revenue, cogs, grossProfit: grossProfit(revenue, cogs),
      paymentMethod: saleData.paymentMethod, paidAmount, balanceDue: decimalSubtract(revenue, paidAmount),
      date: dateValue(saleData.date), reversalOfId: id,
    }).returning();
    await tx.insert(stockTransactionsTable).values({ itemType: "product", materialId: null, productId: product.id, quantityIn: "0", quantityOut: String(saleData.quantity), unit: "bottles", transactionType: "SALE", referenceId: sale.id, notes: `Edited sale replacing #${id}` });
    if (decimalIsPositive(paidAmount)) await tx.insert(paymentsTable).values({ customerId: customer.id, amount: paidAmount, method: saleData.paymentMethod, date: dateValue(saleData.date), notes: `Payment for edited sale #${sale.id}` });
    return sale;
  });
  res.status(200).json({ id: result.id, status: TRANSACTION_STATUS.COMPLETED, reversalOfId: id });
});

router.get("/payments", async (_req, res): Promise<void> => {
  const rows = await db.select({
    id: paymentsTable.id,
    customerId: customersTable.id,
    customerName: customersTable.name,
    amount: paymentsTable.amount,
    method: paymentsTable.method,
    date: paymentsTable.date,
    notes: paymentsTable.notes,
    status: paymentsTable.status,
    cancelledAt: paymentsTable.cancelledAt,
    reversalReason: paymentsTable.reversalReason,
    reversalOfId: paymentsTable.reversalOfId,
  }).from(paymentsTable).innerJoin(customersTable, eq(paymentsTable.customerId, customersTable.id)).orderBy(desc(paymentsTable.id));
  res.json(GetPaymentsResponse.parse(rows.map((row) => ({ ...row, amount: asMoneyNumber(row.amount) }))));
});

router.post("/payments", async (req, res): Promise<void> => {
  const parsed = CreatePaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, parsed.data.customerId));
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  const [row] = await db.insert(paymentsTable).values({
    customerId: parsed.data.customerId,
    amount: String(parsed.data.amount),
    method: parsed.data.method,
    date: dateValue(parsed.data.date),
    notes: parsed.data.notes ?? "",
  }).returning();
  res.status(201).json(CreatePaymentResponse.parse({ ...row, amount: asMoneyNumber(row.amount), customerName: customer.name }));
});

router.post("/payments/:id/cancel", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!Number.isInteger(id) || !reason) { res.status(400).json({ error: "A transaction id and cancellation reason are required" }); return; }
  await db.transaction(async (tx) => cancelPayment(id, reason, tx));
  res.json({ id, status: TRANSACTION_STATUS.CANCELLED, reason });
});

router.put("/payments/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = CreatePaymentBody.partial().safeParse(req.body);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "Edited transaction";
  if (!Number.isInteger(id) || !parsed.success) { res.status(400).json({ error: "Invalid payment edit" }); return; }
  const result = await db.transaction(async (tx) => {
    const [original] = await tx.select().from(paymentsTable).where(eq(paymentsTable.id, id));
    if (!original) throw new Error("Payment not found");
    const paymentData = { customerId: parsed.data.customerId ?? original.customerId, amount: parsed.data.amount ?? Number(original.amount), method: parsed.data.method ?? original.method, date: parsed.data.date ?? new Date(`${original.date}T00:00:00Z`), notes: parsed.data.notes ?? original.notes };
    await cancelPayment(id, reason, tx, TRANSACTION_STATUS.REVERSED);
    const [payment] = await tx.insert(paymentsTable).values({ customerId: paymentData.customerId, amount: String(paymentData.amount), method: paymentData.method, date: dateValue(paymentData.date), notes: paymentData.notes, reversalOfId: id }).returning();
    return payment;
  });
  res.status(200).json({ id: result.id, status: TRANSACTION_STATUS.COMPLETED, reversalOfId: id });
});

router.get("/expenses", async (_req, res): Promise<void> => {
  const rows = await db.select().from(expensesTable).orderBy(desc(expensesTable.id));
  res.json(GetExpensesResponse.parse(rows.map((row) => ({ ...row, amount: asMoneyNumber(row.amount) }))));
});

router.post("/expenses", async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(expensesTable).values({
    category: parsed.data.category,
    amount: String(parsed.data.amount),
    date: dateValue(parsed.data.date),
    paymentMethod: parsed.data.paymentMethod,
    description: parsed.data.description ?? "",
  }).returning();
  res.status(201).json(CreateExpenseResponse.parse({ ...row, amount: asMoneyNumber(row.amount) }));
});

router.post("/expenses/:id/cancel", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!Number.isInteger(id) || !reason) { res.status(400).json({ error: "A transaction id and cancellation reason are required" }); return; }
  await db.transaction(async (tx) => cancelExpense(id, reason, tx));
  res.json({ id, status: TRANSACTION_STATUS.CANCELLED, reason });
});

router.put("/expenses/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = CreateExpenseBody.partial().safeParse(req.body);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "Edited transaction";
  if (!Number.isInteger(id) || !parsed.success) { res.status(400).json({ error: "Invalid expense edit" }); return; }
  const result = await db.transaction(async (tx) => {
    const [original] = await tx.select().from(expensesTable).where(eq(expensesTable.id, id));
    if (!original) throw new Error("Expense not found");
    const expenseData = { category: parsed.data.category ?? original.category, amount: parsed.data.amount ?? Number(original.amount), date: parsed.data.date ?? new Date(`${original.date}T00:00:00Z`), paymentMethod: parsed.data.paymentMethod ?? original.paymentMethod, description: parsed.data.description ?? original.description };
    await cancelExpense(id, reason, tx, TRANSACTION_STATUS.REVERSED);
    const [expense] = await tx.insert(expensesTable).values({ category: expenseData.category, amount: String(expenseData.amount), date: dateValue(expenseData.date), paymentMethod: expenseData.paymentMethod, description: expenseData.description, reversalOfId: id }).returning();
    return expense;
  });
  res.status(200).json({ id: result.id, status: TRANSACTION_STATUS.COMPLETED, reversalOfId: id });
});

router.get("/stock-ledger", async (req, res): Promise<void> => {
  const parsed = GetStockLedgerQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const rows = await db.select({
    id: stockTransactionsTable.id,
    itemType: stockTransactionsTable.itemType,
    itemName: sql<string>`coalesce(${materialsTable.name}, ${productsTable.name}, 'Unknown')`,
    quantityIn: stockTransactionsTable.quantityIn,
    quantityOut: stockTransactionsTable.quantityOut,
    unit: stockTransactionsTable.unit,
    transactionType: stockTransactionsTable.transactionType,
    referenceId: stockTransactionsTable.referenceId,
    date: stockTransactionsTable.date,
    notes: stockTransactionsTable.notes,
  }).from(stockTransactionsTable)
    .leftJoin(materialsTable, eq(stockTransactionsTable.materialId, materialsTable.id))
    .leftJoin(productsTable, eq(stockTransactionsTable.productId, productsTable.id))
    .where(parsed.data.search ? or(ilike(materialsTable.name, `%${parsed.data.search}%`), ilike(productsTable.name, `%${parsed.data.search}%`)) : undefined)
    .orderBy(desc(stockTransactionsTable.id));
  res.json(GetStockLedgerResponse.parse(rows.map((row) => ({
    ...row,
    quantityIn: asNumber(row.quantityIn),
    quantityOut: asNumber(row.quantityOut),
  }))));
});

router.get("/reports/profit-loss", async (req, res): Promise<void> => {
  const fromParam = typeof req.query.from === "string"
    ? new Date(`${req.query.from}T00:00:00Z`)
    : undefined;
  const toParam = typeof req.query.to === "string"
    ? new Date(`${req.query.to}T00:00:00Z`)
    : undefined;
  const parsed = GetProfitLossQueryParams.safeParse({ from: fromParam, to: toParam });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const from = parsed.data.from ? dateValue(parsed.data.from) : `${new Date().getFullYear()}-01-01`;
  const to = parsed.data.to ? dateValue(parsed.data.to) : today();
  const [sales] = await db.select({ revenue: sql<string>`coalesce(sum(${salesTable.revenue}), 0)`, cogs: sql<string>`coalesce(sum(${salesTable.cogs}), 0)` }).from(salesTable).where(and(sql`${salesTable.date} >= ${from}`, sql`${salesTable.date} <= ${to}`, eq(salesTable.status, TRANSACTION_STATUS.COMPLETED)));
  const [expenses] = await db.select({ total: sql<string>`coalesce(sum(${expensesTable.amount}), 0)` }).from(expensesTable).where(and(sql`${expensesTable.date} >= ${from}`, sql`${expensesTable.date} <= ${to}`, eq(expensesTable.status, TRANSACTION_STATUS.COMPLETED)));
  const revenue = sales?.revenue ?? "0";
  const cogs = sales?.cogs ?? "0";
  const expenseTotal = expenses?.total ?? "0";
  const gross = grossProfit(revenue, cogs);
  const net = netProfit(gross, expenseTotal);
  const result = {
    revenue: asMoneyNumber(revenue),
    cogs: asMoneyNumber(cogs),
    grossProfit: asMoneyNumber(gross),
    grossMargin: decimalCompare(revenue, 0) !== 0 ? asNumber(decimalMultiply(decimalDivide(gross, revenue), 100)) : 0,
    expenses: asMoneyNumber(expenseTotal),
    netProfit: asMoneyNumber(net),
    netMargin: decimalCompare(revenue, 0) !== 0 ? asNumber(decimalMultiply(decimalDivide(net, revenue), 100)) : 0,
    from: new Date(`${from}T00:00:00Z`),
    to: new Date(`${to}T00:00:00Z`),
  };
  res.json(GetProfitLossResponse.parse(result));
});

router.use((error: unknown, _req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) => {
  const message = error instanceof Error ? error.message : "Operation failed";
  logger.warn({ message }, "Business operation failed");
  res.status(400).json({ error: message });
});

export default router;