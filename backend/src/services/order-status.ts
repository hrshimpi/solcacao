// How an order moves. It is paid when it is made, then the team packs it (processing), sends it (shipped) and it arrives
// (delivered). It can be cancelled until it is shipped: the stock goes back and the payment is refunded. A customer can
// cancel on their own only while it is still just paid, before anybody started to pack it.
import type { OrderStatus } from "../models/order.model.ts";

const next: Record<OrderStatus, OrderStatus[]> = {
  paid: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function canChange(from: OrderStatus, to: OrderStatus): boolean {
  return next[from].includes(to);
}

export const nextStatuses = (from: OrderStatus): OrderStatus[] => [...next[from]];

export const customerCanCancel = (status: OrderStatus): boolean => status === "paid";
