import { randomBytes as nodeRandomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

const secretTypes = {
  "internal-billing-key": {
    envName: "WEB_INTERNAL_BILLING_KEY",
    create: createInternalBillingKey,
  },
};

export function createInternalBillingKey({
  randomBytes = nodeRandomBytes,
} = {}) {
  return `kroma_web_bill_${randomBytes(32).toString("base64url")}`;
}

function printUsage() {
  console.log("Usage: npm run secret:internal-billing");
}

function main() {
  const secretType = process.argv[2] ?? "internal-billing-key";
  const generator = secretTypes[secretType];

  if (!generator) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  console.log(`${generator.envName}=${generator.create()}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
