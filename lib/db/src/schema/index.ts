import {
  boolean,
  date,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const materialsTable = pgTable("materials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  purchaseUnit: text("purchase_unit").notNull(),
  baseUnit: text("base_unit").notNull(),
  conversionFactor: real("conversion_factor").notNull().default(1),
  minimumStock: real("minimum_stock").notNull().default(0),
  averageCost: real("average_cost").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  openingBalance: real("opening_balance").notNull().default(0),
  paymentTerms: text("payment_terms").notNull().default("Due on receipt"),
  active: boolean("active").notNull().default(true),
});

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  openingBalance: real("opening_balance").notNull().default(0),
  creditLimit: real("credit_limit").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  colour: text("colour").notNull().default(""),
  bottleSize: real("bottle_size").notNull(),
  sellingPrice: real("selling_price").notNull().default(0),
  minimumStock: integer("minimum_stock").notNull().default(0),
  averageCost: real("average_cost").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const productBomTable = pgTable("product_bom", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  materialId: integer("material_id").notNull().references(() => materialsTable.id),
  quantity: real("quantity").notNull(),
});

export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull().references(() => suppliersTable.id),
  materialId: integer("material_id").notNull().references(() => materialsTable.id),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull(),
  baseQuantity: real("base_quantity").notNull(),
  price: real("price").notNull(),
  total: real("total").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  invoiceNumber: text("invoice_number").notNull().default(""),
  notes: text("notes").notNull().default(""),
});

export const productionTable = pgTable("production", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: integer("quantity").notNull(),
  unitCost: real("unit_cost").notNull(),
  totalCost: real("total_cost").notNull(),
  date: date("date", { mode: "string" }).notNull(),
});

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: integer("quantity").notNull(),
  sellingPrice: real("selling_price").notNull(),
  revenue: real("revenue").notNull(),
  cogs: real("cogs").notNull(),
  grossProfit: real("gross_profit").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paidAmount: real("paid_amount").notNull().default(0),
  balanceDue: real("balance_due").notNull().default(0),
  date: date("date", { mode: "string" }).notNull(),
});

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  amount: real("amount").notNull(),
  method: text("method").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  notes: text("notes").notNull().default(""),
});

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  amount: real("amount").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  description: text("description").notNull().default(""),
});

export const stockTransactionsTable = pgTable("stock_transactions", {
  id: serial("id").primaryKey(),
  itemType: text("item_type").notNull(),
  materialId: integer("material_id").references(() => materialsTable.id),
  productId: integer("product_id").references(() => productsTable.id),
  quantityIn: real("quantity_in").notNull().default(0),
  quantityOut: real("quantity_out").notNull().default(0),
  unit: text("unit").notNull(),
  transactionType: text("transaction_type").notNull(),
  referenceId: integer("reference_id").notNull(),
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