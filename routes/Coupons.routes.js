import express from "express";
import {
    addCoupons,
    deleteCouponById,
    getActiveCoupons,
    getAllCoupons,
    updateCouponsById,
    addMultipleCoupons,
    applyCoupon,
    getActiveCouponsQrZip,
    generateCoupon,
    getCouponCount,
    getAllCouponsAnalytics,
    getActiveCouponsExcel,
} from "../controllers/coupons.controller";
import { authorizeJwt } from "../middlewares/auth.middleware";

let router = express.Router();

router.post("/addCoupon", addCoupons);
router.get("/getCoupons", getAllCoupons);
router.get("/getAllCouponsAnalytics", getAllCouponsAnalytics);
router.get("/getCouponsCount", getCouponCount);
router.patch("/updateById/:id", updateCouponsById);
router.delete("/deleteById/:id", deleteCouponById);
router.get("/getActiveCoupons", getActiveCoupons);
router.get("/getActiveCouponsQrZip", getActiveCouponsQrZip);
router.get("/getActiveCouponsQrExcel", getActiveCouponsExcel);
router.post("/addMultipleCoupons", addMultipleCoupons);
router.post("/applyCoupon/:id", authorizeJwt, applyCoupon);
router.post("/generateCoupon", authorizeJwt, generateCoupon);

export default router;
