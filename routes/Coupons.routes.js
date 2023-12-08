import express from "express";
import { addCoupons, deleteCouponById, getActiveCoupons, getAllCoupons, updateCouponsById, addMultipleCoupons, applyCoupon, getActiveCouponsQrZip } from "../controllers/coupons.controller";
import { authorizeJwt } from "../middlewares/auth.middleware";

let router = express.Router();

router.post("/addCoupon", addCoupons);
router.get("/getCoupons", getAllCoupons);
router.patch("/updateById/:id", updateCouponsById);

router.delete("/deleteById/:id", deleteCouponById);
router.get("/getActiveCoupons", getActiveCoupons);
router.get("/getActiveCouponsQrZip", getActiveCouponsQrZip);
router.post("/addMultipleCoupons", addMultipleCoupons);
router.get("/applyCoupon/:id", authorizeJwt, applyCoupon);

export default router;