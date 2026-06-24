import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuthCodeSecret,
  createInternalBillingKey,
} from "./generate-production-secret.mjs";

test("generates a strong URL-safe internal billing key", () => {
  const key = createInternalBillingKey({
    randomBytes: (length) => Buffer.alloc(length, 255),
  });

  assert.match(key, /^kroma_web_bill_[A-Za-z0-9_-]+$/);
  assert.ok(key.length >= 56);
});

test("generates a strong URL-safe auth code secret", () => {
  const key = createAuthCodeSecret({
    randomBytes: (length) => Buffer.alloc(length, 127),
  });

  assert.match(key, /^kroma_web_auth_[A-Za-z0-9_-]+$/);
  assert.ok(key.length >= 56);
});
