import assert from "node:assert/strict";
import test from "node:test";
import { createInternalBillingKey } from "./generate-production-secret.mjs";

test("generates a strong URL-safe internal billing key", () => {
  const key = createInternalBillingKey({
    randomBytes: (length) => Buffer.alloc(length, 255),
  });

  assert.match(key, /^kroma_web_bill_[A-Za-z0-9_-]+$/);
  assert.ok(key.length >= 56);
});
