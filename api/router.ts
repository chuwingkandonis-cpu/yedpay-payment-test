import { createRouter, publicQuery } from "./middleware";
import { yedpayRouter } from "./yedpay/router";
import { ordersRouter } from "./yedpay/orders";
import { travelRouter } from "./yedpay/travel";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  yedpay: yedpayRouter,
  orders: ordersRouter,
  travel: travelRouter,
});

export type AppRouter = typeof appRouter;
