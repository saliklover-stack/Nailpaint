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

const router: IRouter = Router();
const today = () => new Date().toISOString().slice(0, 10);
let seeded = false;

const round = (value: number) => Math.round(value * 100) / 100;
const asNumber = (value: unknown) => Number(value ?? 0);
const dateValue = (value: Date | string) =>
  typeof value === "string" ? value : value.toISOString().slice(0, 10);

async function ensureSeed() {
  if (seeded) return;
  const [existing] = await db.select({ id: materialsTable.id }).from(materialsTable).limit(1);
  if (!existing) {
    const [chemical, brush, glass, cap, pigment] = await db
      .insert(materialsTable)
      .values([
        { name: "Chemical", category: "Base", purchaseUnit: "L", baseUnit: "ml", conversionFactor: 1000, minimumStock: 5000 },
        { name: "Brush", category: "Packaging", purchaseUnit: "pcs", baseUnit: "pcs", conversionFactor: 1, minimumStock: 100 },
        { name: "Glass bottle", category: "Packaging", purchaseUnit: "pcs", baseUnit: "pcs", conversionFactor: 1, minimumStock: 100 },
        { name: "Cap", category: "Packaging", purchaseUnit: "pcs", baseUnit: "pcs", conversionFactor: 1, minimumStock: 100 },
        { name: "Ruby Red Pigment", category: "Pigment", purchaseUnit: "kg", baseUnit: "g", conversionFactor: 1000, minimumStock: 500 },
      ])
      .returning();
    const [product] = await db.insert(productsTable).values({
      sku: "RR-10",
      name: "Ruby Red 10 ml",
      colour: "Ruby red",
      bottleSize: 10,
      sellingPrice: 18,
      minimumStock: 100,
      averageCost: 0,
    }).returning();
    await db.insert(productBomTable).values([
      { productId: product.id, materialId: chemical.id, quantity: 10 },
      { productId: product.id, materialId: brush.id, quantity: 1 },
      { productId: product.id, materialId: glass.id, quantity: 1 },
      { productId: product.id, materialId: cap.id, quantity: 1 },
      { productId: product.id, materialId: pigment.id, quantity: 0.2 },
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
      creditLimit: 5000,
    });
    await db.insert(purchasesTable).values([
      { supplierId: supplier.id, materialId: chemical.id, quantity: 20, unit: "L", baseQuantity: 20000, price: 500, total: 500, date: today(), invoiceNumber: "DEMO-001" },
      { supplierId: supplier.id, materialId: brush.id, quantity: 1000, unit: "pcs", baseQuantity: 1000, price: 100, total: 100, date: today(), invoiceNumber: "DEMO-001" },
      { supplierId: supplier.id, materialId: glass.id, quantity: 1000, unit: "pcs", baseQuantity: 1000, price: 300, total: 300, date: today(), invoiceNumber: "DEMO-001" },
      { supplierId: supplier.id, materialId: cap.id, quantity: 1000, unit: "pcs", baseQuantity: 1000, price: 150, total: 150, date: today(), invoiceNumber: "DEMO-001" },
      { supplierId: supplier.id, materialId: pigment.id, quantity: 1, unit: "kg", baseQuantity: 1000, price: 200, total: 200, date: today(), invoiceNumber: "DEMO-001" },
    ]);
    const [purchaseRows] = await Promise.all([
      db.select().from(purchasesTable).where(eq(purchasesTable.invoiceNumber, "DEMO-001")),
    ]);
    await db.insert(stockTransactionsTable).values(purchaseRows.map((purchase) => ({
      itemType: "material",
      materialId: purchase.materialId,
      productId: null,
      quantityIn: purchase.baseQuantity,
      quantityOut: 0,
      unit: purchase.unit,
      transactionType: "PURCHASE",
      referenceId: purchase.id,
      notes: "Demo opening stock",
    })));
    await db.update(materialsTable).set({ averageCost: 0.025 }).where(eq(materialsTable.id, chemical.id));
    await db.update(materialsTable).set({ averageCost: 0.1 }).where(eq(materialsTable.id, brush.id));
    await db.update(materialsTable).set({ averageCost: 0.3 }).where(eq(materialsTable.id, glass.id));
    await db.update(materialsTable).set({ averageCost: 0.15 }).where(eq(materialsTable.id, cap.id));
    await db.update(materialsTable).set({ averageCost: 0.2 }).where(eq(materialsTable.id, pigment.id));
  }
  seeded = true;
}

async function materialStock(materialId: number, executor: any = db) {
  const [row] = await executor
    .select({ stock: sql<number>`coalesce(sum(${stockTransactionsTable.quantityIn}) - sum(${stockTransactionsTable.quantityOut}), 0)` })
    .from(stockTransactionsTable)
    .where(eq(stockTransactionsTable.materialId, materialId));
  return asNumber(row?.stock);
}

async function productStock(productId: number, executor: any = db) {
  const [row] = await executor
    .select({ stock: sql<number>`coalesce(sum(${stockTransactionsTable.quantityIn}) - sum(${stockTransactionsTable.quantityOut}), 0)` })
    .from(stockTransactionsTable)
    .where(eq(stockTransactionsTable.productId, productId));
  return Math.round(asNumber(row?.stock));
}

async function materialView(material: typeof materialsTable.$inferSelect, executor: any = db) {
  return {
    id: material.id,
    name: material.name,
    category: material.category,
    purchaseUnit: material.purchaseUnit,
    baseUnit: material.baseUnit,
    conversionFactor: material.conversionFactor,
    minimumStock: material.minimumStock,
    currentStock: round(await materialStock(material.id, executor)),
    averageCost: round(material.averageCost),
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
    bottleSize: product.bottleSize,
    sellingPrice: product.sellingPrice,
    minimumStock: product.minimumStock,
    currentStock: await productStock(product.id, executor),
    averageCost: round(product.averageCost),
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
    bomQuantity: number;
    unit: string;
    averageCost: number;
  }>).map(async (line) => {
    const required = line.bomQuantity * quantity;
    const available = await materialStock(line.materialId, executor);
    return {
      materialId: line.materialId,
      materialName: line.materialName,
      unit: line.unit,
      required: round(required),
      available: round(available),
      shortage: round(Math.max(0, required - available)),
      cost: required * line.averageCost,
    };
  }));
  const totalCost = requirements.reduce((sum, line) => sum + line.cost, 0);
  return {
    canProduce: requirements.every((line) => line.shortage <= 0),
    productName: product.name,
    quantity,
    estimatedUnitCost: quantity ? round(totalCost / quantity) : 0,
    requirements: requirements.map(({ cost: _cost, ...line }) => line),
  };
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  await ensureSeed();
  const [salesTotals] = await db.select({
    revenue: sql<number>`coalesce(sum(${salesTable.revenue}), 0)`,
    grossProfit: sql<number>`coalesce(sum(${salesTable.grossProfit}), 0)`,
    productsSold: sql<number>`coalesce(sum(${salesTable.quantity}), 0)`,
  }).from(salesTable);
  const [expenseTotals] = await db.select({ total: sql<number>`coalesce(sum(${expensesTable.amount}), 0)` }).from(expensesTable);
  const materials = await Promise.all((await db.select().from(materialsTable).where(eq(materialsTable.active, true))).map((row) => materialView(row)));
  const products = await Promise.all((await db.select().from(productsTable).where(eq(productsTable.active, true))).map((row) => productView(row)));
  const recentSales = await db.select({ id: salesTable.id, revenue: salesTable.revenue, date: salesTable.date, productName: productsTable.name }).from(salesTable).innerJoin(productsTable, eq(salesTable.productId, productsTable.id)).orderBy(desc(salesTable.id)).limit(5);
  const recentPurchases = await db.select({ id: purchasesTable.id, total: purchasesTable.total, date: purchasesTable.date, materialName: materialsTable.name }).from(purchasesTable).innerJoin(materialsTable, eq(purchasesTable.materialId, materialsTable.id)).orderBy(desc(purchasesTable.id)).limit(5);
  const dashboard = {
    todaySales: round(asNumber(salesTotals?.revenue)),
    monthSales: round(asNumber(salesTotals?.revenue)),
    productsSold: Math.round(asNumber(salesTotals?.productsSold)),
    grossProfit: round(asNumber(salesTotals?.grossProfit)),
    netProfit: round(asNumber(salesTotals?.grossProfit) - asNumber(expenseTotals?.total)),
    expenses: round(asNumber(expenseTotals?.total)),
    rawMaterialValue: round(materials.reduce((sum, material) => sum + material.currentStock * material.averageCost, 0)),
    finishedStockValue: round(products.reduce((sum, product) => sum + product.currentStock * product.averageCost, 0)),
    customerReceivables: round(Math.max(0, asNumber((await db.select({ total: sql<number>`coalesce(sum(${salesTable.balanceDue}), 0)` }).from(salesTable))[0]?.total) - asNumber((await db.select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)` }).from(paymentsTable))[0]?.total))),
    supplierPayables: round(asNumber((await db.select({ total: sql<number>`coalesce(sum(${purchasesTable.total}), 0)` }).from(purchasesTable))[0]?.total)),
    lowStockMaterials: materials.filter((material) => material.currentStock <= material.minimumStock),
    lowStockProducts: products.filter((product) => product.currentStock <= product.minimumStock),
    recentActivity: [
      ...recentSales.map((item) => ({ type: "SALE", label: item.productName, amount: item.revenue, date: new Date(`${item.date}T12:00:00Z`).toISOString() })),
      ...recentPurchases.map((item) => ({ type: "PURCHASE", label: item.materialName, amount: item.total, date: new Date(`${item.date}T12:00:00Z`).toISOString() })),
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
  const [row] = await db.insert(materialsTable).values(parsed.data).returning();
  res.status(201).json(CreateMaterialResponse.parse(await materialView(row)));
});

router.get("/suppliers", async (_req, res): Promise<void> => {
  await ensureSeed();
  const rows = await db.select().from(suppliersTable).orderBy(suppliersTable.name);
  const output = await Promise.all(rows.map(async (row) => {
    const [purchases] = await db.select({ total: sql<number>`coalesce(sum(${purchasesTable.total}), 0)` }).from(purchasesTable).where(eq(purchasesTable.supplierId, row.id));
    return { ...row, outstandingBalance: round(row.openingBalance + asNumber(purchases?.total)) };
  }));
  res.json(GetSuppliersResponse.parse(output));
});

router.post("/suppliers", async (req, res): Promise<void> => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(suppliersTable).values(parsed.data).returning();
  res.status(201).json(CreateSupplierResponse.parse({ ...row, outstandingBalance: row.openingBalance }));
});

router.get("/purchases", async (_req, res): Promise<void> => {
  await ensureSeed();
  const rows = await db.select({
    id: purchasesTable.id, supplierId: suppliersTable.id, supplierName: suppliersTable.name,
    materialId: materialsTable.id, materialName: materialsTable.name, quantity: purchasesTable.quantity,
    unit: purchasesTable.unit, baseQuantity: purchasesTable.baseQuantity, price: purchasesTable.price,
    total: purchasesTable.total, date: purchasesTable.date, invoiceNumber: purchasesTable.invoiceNumber, notes: purchasesTable.notes,
  }).from(purchasesTable).innerJoin(suppliersTable, eq(purchasesTable.supplierId, suppliersTable.id)).innerJoin(materialsTable, eq(purchasesTable.materialId, materialsTable.id)).orderBy(desc(purchasesTable.id));
  res.json(GetPurchasesResponse.parse(rows));
});

router.post("/purchases", async (req, res): Promise<void> => {
  const parsed = CreatePurchaseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const result = await db.transaction(async (tx) => {
    const [material] = await tx.select().from(materialsTable).where(eq(materialsTable.id, parsed.data.materialId));
    if (!material) throw new Error("Material not found");
    const baseQuantity = parsed.data.quantity * material.conversionFactor;
    const [purchase] = await tx.insert(purchasesTable).values({
      supplierId: parsed.data.supplierId,
      materialId: parsed.data.materialId,
      quantity: parsed.data.quantity,
      unit: material.purchaseUnit,
      baseQuantity,
      total: parsed.data.price,
      price: parsed.data.price,
      date: dateValue(parsed.data.date),
      invoiceNumber: parsed.data.invoiceNumber ?? "",
      notes: parsed.data.notes ?? "",
    }).returning();
    const oldStock = await materialStock(material.id, tx);
    const oldValue = oldStock * material.averageCost;
    const newCost = baseQuantity ? (oldValue + parsed.data.price) / (oldStock + baseQuantity) : material.averageCost;
    await tx.update(materialsTable).set({ averageCost: newCost }).where(eq(materialsTable.id, material.id));
    await tx.insert(stockTransactionsTable).values({
      itemType: "material", materialId: material.id, productId: null, quantityIn: baseQuantity, quantityOut: 0,
      unit: material.baseUnit, transactionType: "PURCHASE", referenceId: purchase.id, notes: parsed.data.notes ?? "",
    });
    return purchase;
  });
  const [row] = await db.select({
    id: purchasesTable.id, supplierId: suppliersTable.id, supplierName: suppliersTable.name,
    materialId: materialsTable.id, materialName: materialsTable.name, quantity: purchasesTable.quantity,
    unit: purchasesTable.unit, baseQuantity: purchasesTable.baseQuantity, price: purchasesTable.price,
    total: purchasesTable.total, date: purchasesTable.date, invoiceNumber: purchasesTable.invoiceNumber, notes: purchasesTable.notes,
  }).from(purchasesTable).innerJoin(suppliersTable, eq(purchasesTable.supplierId, suppliersTable.id)).innerJoin(materialsTable, eq(purchasesTable.materialId, materialsTable.id)).where(eq(purchasesTable.id, result.id));
  res.status(201).json(CreatePurchaseResponse.parse(row));
});

router.get("/products", async (_req, res): Promise<void> => {
  await ensureSeed();
  const rows = await db.select().from(productsTable).orderBy(productsTable.name);
  res.json(GetProductsResponse.parse(await Promise.all(rows.map((row) => productView(row)))));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(productsTable).values(parsed.data).returning();
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
    if (parsed.data.lines.length) await tx.insert(productBomTable).values(parsed.data.lines.map((line) => ({ productId: product.id, ...line })));
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
  const rows = await db.select({ id: productionTable.id, productId: productsTable.id, productName: productsTable.name, quantity: productionTable.quantity, unitCost: productionTable.unitCost, totalCost: productionTable.totalCost, date: productionTable.date }).from(productionTable).innerJoin(productsTable, eq(productionTable.productId, productsTable.id)).orderBy(desc(productionTable.id));
  res.json(GetProductionsResponse.parse(rows));
});

router.post("/production", async (req, res): Promise<void> => {
  const parsed = CreateProductionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const result = await db.transaction(async (tx) => {
    const check = await productionCheck(parsed.data.productId, parsed.data.quantity, tx);
    if (!check) throw new Error("Product not found");
    if (!check.canProduce) {
      const shortage = check.requirements.find((line) => line.shortage > 0);
      throw new Error(`Insufficient ${shortage?.materialName ?? "material"} stock. Required: ${shortage?.required ?? 0} ${shortage?.unit ?? ""}. Available: ${shortage?.available ?? 0} ${shortage?.unit ?? ""}.`);
    }
    const [production] = await tx.insert(productionTable).values({
      productId: parsed.data.productId, quantity: parsed.data.quantity, unitCost: check.estimatedUnitCost,
      totalCost: check.estimatedUnitCost * parsed.data.quantity, date: dateValue(parsed.data.date),
    }).returning();
    const lines = await tx.select().from(productBomTable).where(eq(productBomTable.productId, parsed.data.productId));
    for (const line of lines) {
      const material = (await tx.select().from(materialsTable).where(eq(materialsTable.id, line.materialId)))[0];
      await tx.insert(stockTransactionsTable).values({
        itemType: "material", materialId: line.materialId, productId: null, quantityIn: 0,
        quantityOut: line.quantity * parsed.data.quantity, unit: material.baseUnit, transactionType: "PRODUCTION_CONSUMPTION", referenceId: production.id, notes: `Production #${production.id}`,
      });
    }
    await tx.insert(stockTransactionsTable).values({
      itemType: "product", materialId: null, productId: parsed.data.productId, quantityIn: parsed.data.quantity,
      quantityOut: 0, unit: "bottles", transactionType: "PRODUCTION_OUTPUT", referenceId: production.id, notes: `Production #${production.id}`,
    });
    await tx.update(productsTable).set({ averageCost: check.estimatedUnitCost }).where(eq(productsTable.id, parsed.data.productId));
    return production;
  });
  const [row] = await db.select({ id: productionTable.id, productId: productsTable.id, productName: productsTable.name, quantity: productionTable.quantity, unitCost: productionTable.unitCost, totalCost: productionTable.totalCost, date: productionTable.date }).from(productionTable).innerJoin(productsTable, eq(productionTable.productId, productsTable.id)).where(eq(productionTable.id, result.id));
  res.status(201).json(CreateProductionResponse.parse(row));
});

router.get("/customers", async (_req, res): Promise<void> => {
  await ensureSeed();
  const rows = await db.select().from(customersTable).orderBy(customersTable.name);
  const output = await Promise.all(rows.map(async (row) => {
    const [sales] = await db.select({ total: sql<number>`coalesce(sum(${salesTable.balanceDue}), 0)` }).from(salesTable).where(eq(salesTable.customerId, row.id));
    const [payments] = await db.select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)` }).from(paymentsTable).where(eq(paymentsTable.customerId, row.id));
    return { ...row, outstandingBalance: round(row.openingBalance + asNumber(sales?.total) - asNumber(payments?.total)) };
  }));
  res.json(GetCustomersResponse.parse(output));
});

router.post("/customers", async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(customersTable).values(parsed.data).returning();
  res.status(201).json(CreateCustomerResponse.parse({ ...row, outstandingBalance: row.openingBalance }));
});

router.get("/sales", async (_req, res): Promise<void> => {
  await ensureSeed();
  const rows = await db.select({ id: salesTable.id, customerId: customersTable.id, customerName: customersTable.name, productId: productsTable.id, productName: productsTable.name, quantity: salesTable.quantity, sellingPrice: salesTable.sellingPrice, revenue: salesTable.revenue, cogs: salesTable.cogs, grossProfit: salesTable.grossProfit, paymentMethod: salesTable.paymentMethod, paidAmount: salesTable.paidAmount, balanceDue: salesTable.balanceDue, date: salesTable.date }).from(salesTable).innerJoin(customersTable, eq(salesTable.customerId, customersTable.id)).innerJoin(productsTable, eq(salesTable.productId, productsTable.id)).orderBy(desc(salesTable.id));
  res.json(GetSalesResponse.parse(rows));
});

router.post("/sales", async (req, res): Promise<void> => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const result = await db.transaction(async (tx) => {
    const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, parsed.data.productId));
    if (!product) throw new Error("Product not found");
    const [customer] = await tx.select().from(customersTable).where(eq(customersTable.id, parsed.data.customerId));
    if (!customer) throw new Error("Customer not found");
    const stock = await productStock(product.id, tx);
    if (stock < parsed.data.quantity) throw new Error(`Sale cannot be completed because finished stock is insufficient. Available: ${stock} bottles.`);
    const sellingPrice = parsed.data.sellingPrice ?? product.sellingPrice;
    const revenue = sellingPrice * parsed.data.quantity;
    const cogs = product.averageCost * parsed.data.quantity;
    const paidAmount = Math.min(parsed.data.paidAmount ?? 0, revenue);
    const [sale] = await tx.insert(salesTable).values({
      customerId: parsed.data.customerId, productId: product.id, quantity: parsed.data.quantity,
      sellingPrice, revenue, cogs, grossProfit: revenue - cogs, paymentMethod: parsed.data.paymentMethod,
      paidAmount, balanceDue: revenue - paidAmount, date: dateValue(parsed.data.date),
    }).returning();
    await tx.insert(stockTransactionsTable).values({
      itemType: "product", materialId: null, productId: product.id, quantityIn: 0, quantityOut: parsed.data.quantity,
      unit: "bottles", transactionType: "SALE", referenceId: sale.id, notes: `Sale #${sale.id}`,
    });
    if (paidAmount > 0) await tx.insert(paymentsTable).values({ customerId: customer.id, amount: paidAmount, method: parsed.data.paymentMethod, date: dateValue(parsed.data.date), notes: `Payment for sale #${sale.id}` });
    return sale;
  });
  const [row] = await db.select({ id: salesTable.id, customerId: customersTable.id, customerName: customersTable.name, productId: productsTable.id, productName: productsTable.name, quantity: salesTable.quantity, sellingPrice: salesTable.sellingPrice, revenue: salesTable.revenue, cogs: salesTable.cogs, grossProfit: salesTable.grossProfit, paymentMethod: salesTable.paymentMethod, paidAmount: salesTable.paidAmount, balanceDue: salesTable.balanceDue, date: salesTable.date }).from(salesTable).innerJoin(customersTable, eq(salesTable.customerId, customersTable.id)).innerJoin(productsTable, eq(salesTable.productId, productsTable.id)).where(eq(salesTable.id, result.id));
  res.status(201).json(CreateSaleResponse.parse(row));
});

router.post("/payments", async (req, res): Promise<void> => {
  const parsed = CreatePaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, parsed.data.customerId));
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  const [row] = await db.insert(paymentsTable).values({
    customerId: parsed.data.customerId,
    amount: parsed.data.amount,
    method: parsed.data.method,
    date: dateValue(parsed.data.date),
    notes: parsed.data.notes ?? "",
  }).returning();
  res.status(201).json(CreatePaymentResponse.parse({ ...row, customerName: customer.name }));
});

router.get("/expenses", async (_req, res): Promise<void> => {
  const rows = await db.select().from(expensesTable).orderBy(desc(expensesTable.id));
  res.json(GetExpensesResponse.parse(rows));
});

router.post("/expenses", async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(expensesTable).values({
    category: parsed.data.category,
    amount: parsed.data.amount,
    date: dateValue(parsed.data.date),
    paymentMethod: parsed.data.paymentMethod,
    description: parsed.data.description ?? "",
  }).returning();
  res.status(201).json(CreateExpenseResponse.parse(row));
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
  res.json(GetStockLedgerResponse.parse(rows));
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
  const [sales] = await db.select({ revenue: sql<number>`coalesce(sum(${salesTable.revenue}), 0)`, cogs: sql<number>`coalesce(sum(${salesTable.cogs}), 0)` }).from(salesTable).where(and(sql`${salesTable.date} >= ${from}`, sql`${salesTable.date} <= ${to}`));
  const [expenses] = await db.select({ total: sql<number>`coalesce(sum(${expensesTable.amount}), 0)` }).from(expensesTable).where(and(sql`${expensesTable.date} >= ${from}`, sql`${expensesTable.date} <= ${to}`));
  const revenue = asNumber(sales?.revenue);
  const cogs = asNumber(sales?.cogs);
  const expenseTotal = asNumber(expenses?.total);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenseTotal;
  const result = {
    revenue: round(revenue),
    cogs: round(cogs),
    grossProfit: round(grossProfit),
    grossMargin: revenue ? round(grossProfit / revenue * 100) : 0,
    expenses: round(expenseTotal),
    netProfit: round(netProfit),
    netMargin: revenue ? round(netProfit / revenue * 100) : 0,
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