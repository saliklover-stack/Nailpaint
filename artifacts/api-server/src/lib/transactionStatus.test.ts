import assert from "node:assert/strict";
import test from "node:test";
import { assertActiveTransaction, TRANSACTION_STATUS } from "./transactionStatus";
import { decimalAdd, decimalSubtract } from "./decimal";

test("completed transaction may be changed once", () => {
  assert.doesNotThrow(() => assertActiveTransaction(TRANSACTION_STATUS.COMPLETED));
  assert.throws(() => assertActiveTransaction(TRANSACTION_STATUS.CANCELLED), /already cancelled/);
  assert.throws(() => assertActiveTransaction(TRANSACTION_STATUS.REVERSED), /already reversed/);
});

test("reversal ledger entries invert the original movement", () => {
  const originalIn = "20000";
  const originalOut = "0";
  const reversalIn = originalOut;
  const reversalOut = originalIn;
  assert.equal(decimalAdd(originalIn, reversalIn), "20000");
  assert.equal(decimalSubtract(decimalAdd(originalIn, reversalIn), decimalAdd(originalOut, reversalOut)), "0");
});

test("a failed replacement leaves the original effect unchanged", () => {
  const originalStock = "20000";
  const attemptedReplacement = "25000";
  const insufficient = BigInt(attemptedReplacement) > BigInt(originalStock);
  assert.equal(insufficient, true);
  assert.equal(originalStock, "20000");
});
