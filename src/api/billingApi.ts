import { addCredits } from "../storage/accountStore";
import type { AccountSnapshot } from "../storage/accountStore";
import { buildPurchasePlanRequest } from "./apiContracts";
import { requestRemoteJson, shouldUseRemoteBackend } from "./remoteBackendClient";

export type PaymentChannel = "mock";

export interface PurchasePlanInput {
  planId: string;
  planName: string;
  credits: number;
  paymentChannel: PaymentChannel;
  note: string;
}

export interface PurchasePlanResult {
  orderId: string;
  status: "paid";
  creditedAmount: number;
  account: AccountSnapshot;
}

export async function purchasePlan(
  input: PurchasePlanInput,
): Promise<PurchasePlanResult> {
  const request = buildPurchasePlanRequest(input);

  if (shouldUseRemoteBackend()) {
    return requestRemoteJson<PurchasePlanResult>(request);
  }

  const creditedAmount = Math.max(0, Math.floor(request.body.credits));
  const account = addCredits({
    amount: creditedAmount,
    planId: request.body.planId,
    planName: request.body.planName,
    note: request.body.note,
  });

  return {
    orderId: `mock-order-${request.body.paymentChannel}-${Date.now()}`,
    status: "paid",
    creditedAmount,
    account,
  };
}
