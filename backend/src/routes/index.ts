// The one place where a module's router is added. To add a module, make its router in routes/ and mount it here.
import { Router } from "express";
import { authRouter } from "./auth.routes.ts";
import { b2bRouter } from "./b2b.routes.ts";
import { healthRouter } from "./health.ts";
import { inquiryRouter } from "./inquiries.ts";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/inquiries", inquiryRouter);
apiRouter.use("/b2b", b2bRouter);
