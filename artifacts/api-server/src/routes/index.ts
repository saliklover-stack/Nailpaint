import { Router, type IRouter } from "express";
import healthRouter from "./health";
import businessRouter from "./business";

const router: IRouter = Router();

router.use(healthRouter);
router.use(businessRouter);

export default router;
