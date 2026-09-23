import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// NUMERIC(20,6) provides six decimal places for exact money and stock values.
// Legacy REAL values are converted without intentional business-data changes,
// but binary floating-point representation cannot be recovered exactly.
export const materialsTable = pgTable("materials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  purchaseUnit: text("purchase_unit").notNull(),
  baseUnit: text("base_unit").notNull(),
  conversionFactor: numeric("conversion_factor", { precision: 20, scale: 6 }).notNull().default("1"),
  minimumStock: numeric("minimum_stock", { precision: 20, scale: 6 }).notNull().default("0"),
  averageCost: numeric("average_cost", { precision: 20, scale: 6 }).notNull().default("0"),
  packagingBottles: integer("packaging_bottles").notNull().default(1),
  active: boolean("active").notNull().default(true),
});

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  openingBalance: numeric("opening_balance", { precision: 20, scale: 6 }).notNull().default("0"),
  paymentTerms: text("payment_terms").notNull().default("Due on receipt"),
  active: boolean("active").notNull().default(true),
});

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  openingBalance: numeric("opening_balance", { precision: 20, scale: 6 }).notNull().default("0"),
  creditLimit: numeric("credit_limit", { precision: 20, scale: 6 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
});

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  colour: text("colour").notNull().default(""),
  bottleSize: numeric("bottle_size", { precision: 20, scale: 6 }).notNull(),
  sellingPrice: numeric("selling_price", { precision: 20, scale: 6 }).notNull().default("0"),
  minimumStock: integer("minimum_stock").notNull().default(0),
  averageCost: numeric("average_cost", { precision: 20, scale: 6 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
});

export const productBomTable = pgTable("product_bom", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  materialId: integer("material_id").notNull().references(() => materialsTable.id),
  quantity: numeric("quantity", { precision: 20, scale: 6 }).notNull(),
});

export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull().references(() => suppliersTable.id),
  materialId: integer("material_id").notNull().references(() => materialsTable.id),
  quantity: numeric("quantity", { precision: 20, scale: 6 }).notNull(),
  unit: text("unit").notNull(),
  baseQuantity: numeric("base_quantity", { precision: 20, scale: 6 }).notNull(),
  price: numeric("price", { precision: 20, scale: 6 }).notNull(),
  total: numeric("total", { precision: 20, scale: 6 }).notNull(),
  date: date("date", { mode: "string" }).notNull(),
  invoiceNumber: text("invoice_number").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("completed"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  reversalReason: text("reversal_reason"),
  reversalOfId: integer("reversal_of_id"),
});

export const productionTable = pgTable("production", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: integer("quantity").notNull(),
  unitCost: numeric("unit_cost", { precision: 20, scale: 6 }).notNull(),
  totalCost: numeric("total_cost", { precision: 20, scale: 6 }).notNull(),
  date: date("date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("completed"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  reversalReason: text("reversal_reason"),
  reversalOfId: integer("reversal_of_id"),
});

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: integer("quantity").notNull(),
  sellingPrice: numeric("selling_price", { precision: 20, scale: 6 }).notNull(),
  revenue: numeric("revenue", { precision: 20, scale: 6 }).notNull(),
  cogs: numeric("cogs", { precision: 20, scale: 6 }).notNull(),
  grossProfit: numeric("gross_profit", { precision: 20, scale: 6 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  paidAmount: numeric("paid_amount", { precision: 20, scale: 6 }).notNull().default("0"),
  balanceDue: numeric("balance_due", { precision: 20, scale: 6 }).notNull().default("0"),
  date: date("date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("completed"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  reversalReason: text("reversal_reason"),
  reversalOfId: integer("reversal_of_id"),
});

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  amount: numeric("amount", { precision: 20, scale: 6 }).notNull(),
  method: text("method").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("completed"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  reversalReason: text("reversal_reason"),
  reversalOfId: integer("reversal_of_id"),
});

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 20, scale: 6 }).notNull(),
  date: date("date", { mode: "string" }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("completed"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  reversalReason: text("reversal_reason"),
  reversalOfId: integer("reversal_of_id"),
});

export const stockTransactionsTable = pgTable("stock_transactions", {
  id: serial("id").primaryKey(),
  itemType: text("item_type").notNull(),
  materialId: integer("material_id").references(() => materialsTable.id),
  productId: integer("product_id").references(() => productsTable.id),
  quantityIn: numeric("quantity_in", { precision: 20, scale: 6 }).notNull().default("0"),
  quantityOut: numeric("quantity_out", { precision: 20, scale: 6 }).notNull().default("0"),
  unit: text("unit").notNull(),
  transactionType: text("transaction_type").notNull(),
  referenceId: integer("reference_id").notNull(),
  reversalOfId: integer("reversal_of_id"),
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes").notNull().default(""),
});

export const insertMaterialSchema = createInsertSchema(materialsTable).omit({ id: true });
export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true });
export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true });
export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true });
export const insertProductBomSchema = createInsertSchema(productBomTable).omit({ id: true });
export const insertPurchaseSchema = createInsertSchema(purchasesTable).omit({ id: true });
export const insertProductionSchema = createInsertSchema(productionTable).omit({ id: true });
export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true });
export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true });
export const insertStockTransactionSchema = createInsertSchema(stockTransactionsTable).omit({ id: true });

export type Material = z.infer<typeof insertMaterialSchema> & { id: number };
export type Supplier = z.infer<typeof insertSupplierSchema> & { id: number };
export type Customer = z.infer<typeof insertCustomerSchema> & { id: number };
export type Product = z.infer<typeof insertProductSchema> & { id: number };
export type ProductBom = z.infer<typeof insertProductBomSchema> & { id: number };
export type Purchase = z.infer<typeof insertPurchaseSchema> & { id: number };
export type Production = z.infer<typeof insertProductionSchema> & { id: number };
export type Sale = z.infer<typeof insertSaleSchema> & { id: number };
export type Payment = z.infer<typeof insertPaymentSchema> & { id: number };
export type Expense = z.infer<typeof insertExpenseSchema> & { id: number };
export type StockTransaction = z.infer<typeof insertStockTransactionSchema> & { id: number };