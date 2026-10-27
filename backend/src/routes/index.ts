import { Router } from "express";
import { b2bRouter } from "./b2b.routes.ts";
import { healthRouter } from "./health.ts";
import { inquiryRouter } from "./inquiries.ts";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use("/inquiries", inquiryRouter);
apiRouter.use("/b2b", b2bRouter);
