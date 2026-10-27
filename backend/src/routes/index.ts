import { Router } from "express";
import { healthRouter } from "./health.ts";
import { inquiryRouter } from "./inquiries.ts";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use("/inquiries", inquiryRouter);
