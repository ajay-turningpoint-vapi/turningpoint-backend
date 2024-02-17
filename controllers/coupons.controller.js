// import authorizeJwt from "../middlewares/auth.middleware";

import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import Coupon from "../models/Coupons.model";
import Users from "../models/user.model";
import { createPointlogs } from "./pointHistory.controller";
import { pointTransactionType } from "./../helpers/Constants";
import { generateCouponCode, QrGenerator, ZipGenerator } from "../helpers/Generators";
import productModel from "../models/product.model";
let Couponintial = "TNP";
import _ from "lodash";
import { customAlphabet } from "nanoid";
import mongoose from "mongoose";
const nanoid = customAlphabet("1234567890", 10);
export const addCoupons = async (req, res, next) => {
    try {
        let existsCheck = await Coupon.findOne({ name: req.body.name }).exec();
        if (existsCheck) {
            throw new Error("Coupon with same name already exists, please change coupon's name");
        }

        if (req.body.image) {
            req.body.image = await storeFileAndReturnNameBase64(req.body.image);
        }

        await new Coupon(req.body).save();

        res.status(200).json({ message: "Coupon added", success: true });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

export const getAllCoupons = async (req, res, next) => {
    try {
        let query = {};
        if (req.query.couponUsed && req.query.couponUsed != "All") {
            query.maximumNoOfUsersAllowed = parseInt(req.query.couponUsed);
        }
        if (req.query.productId) {
            query.productId = req.query.productId;
        }

        let couponsArr = await Coupon.find(query).sort({ createdAt: -1 }).lean().exec();

        for (const coupon of couponsArr) {
            if (coupon.productId) {
                coupon.productObj = await productModel.findById(coupon.productId).lean().exec();
            }
        }

        res.status(200).json({ message: "found all coupons", data: couponsArr, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const updateCouponsById = async (req, res, next) => {
    try {
        console.log(req.body);

        let obj = {};

        if (req.body.name && req.body.name != "") {
            obj.name = req.body.name;
        }
        if (req.body.description && req.body.description != "") {
            obj.description = req.body.description;
        }
        if (req.body.discountType && req.body.discountType != "") {
            obj.discountType = req.body.discountType;
        }
        if (req.body.discountType && req.body.discountType != "") {
            obj.discountType = req.body.discountType;
        }
        if (req.body.value && req.body.value != 0) {
            obj.value = req.body.value;
        }
        if (req.body.validTill && req.body.validTill != "") {
            obj.validTill = req.body.validTill;
        }
        if (req.body.maximumNoOfUsersAllowed && req.body.maximumNoOfUsersAllowed >= 0) {
            obj.maximumNoOfUsersAllowed = req.body.maximumNoOfUsersAllowed;
        }

        let updatedCouponObj = await Coupon.findByIdAndUpdate(req.params.id, obj).exec();

        res.status(200).json({ message: "Coupon Updated", success: true });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

export const deleteCouponById = async (req, res, next) => {
    try {
        let CouponObj = await Coupon.findById(req.params.id).lean().exec();
        if (!CouponObj) {
            throw new Error("Coupon not found");
        }

        await Coupon.findByIdAndDelete(req.params.id).lean().exec();
        // console.log(productArr, "ppppppppp")
        res.status(200).json({ message: "Coupon Delete", success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};
export const getActiveCoupons = async (req, res, next) => {
    try {
        let todayStart = new Date();
        todayStart.setHours(0, 0, 0);

        let CouponArr = await Coupon.find({ maximumNoOfUsersAllowed: 1 }).lean().exec();
        // console.log(productArr, "ppppppppp")
        res.status(200).json({ message: "products", data: CouponArr, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getActiveCouponsQrZip = async (req, res, next) => {
    try {
        let todayStart = new Date();
        todayStart.setHours(0, 0, 0);

        let CouponArr = await Coupon.find({ maximumNoOfUsersAllowed: 1 }).lean().exec();
        console.log(CouponArr.length, "CouponArr.length");
        let couponsLocationArr = [];
        let couponsNameArr = [];
        for (const el of CouponArr) {
            let obj = {
                couponId: el._id,
            };
            obj = JSON.stringify(obj);
            let qr = await QrGenerator(obj);
            couponsLocationArr.push(qr.locationVal);
            couponsNameArr.push(qr.fileName);
        }

        console.log(couponsLocationArr, "couponsLocationArr");
        let zipFileLocation = await ZipGenerator(couponsLocationArr);
        console.log(zipFileLocation, "zipFileLocation");

        res.status(200).json({ message: "Coupon zip File Location", data: zipFileLocation, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const addMultipleCoupons = async (req, res, next) => {
    try {
        if (!req.body.hasOwnProperty("coupons") || req.body.coupons.length == 0) {
            throw new Error("Please fill coupon values and their count");
        }

        let productObj = await productModel.findById(req.body.productId).exec();
        let coupons = req.body.coupons;
        let totalCount = 0;
        let totalAmount = 0;
       
        for (const coupon of coupons) {
            totalCount += parseInt(coupon.count);
            totalAmount += parseInt(coupon.count * coupon.value);
        }


        console.log("TotalAmt", req.body.amount, "TotalCount", req.body.count,"totalCount",totalCount,"totalAmount",totalAmount);
        if (totalAmount > req.body.amount) {
            throw new Error("coupon values and their count must be less than total coupon count");
        }

        if (totalCount > req.body.count) {
            throw new Error("number of coupons must be less than total coupons");
        }
        let couponArray = [];

        for (const coupon of coupons) {
            while (coupon.count != 0) {
                let newOBject = { ...coupon };
                newOBject.name = await generateCouponCode();
                couponArray.push(newOBject);
                coupon.count--;
            }
        }

        let remainingCoupon = req.body.count - couponArray.length;
        console.log(remainingCoupon);
        if (remainingCoupon > 0) {
            for (let index = 0; index < remainingCoupon; index++) {
                let blankCoupon = new Object();
                blankCoupon.value = 0;
                blankCoupon.count = 0;
                blankCoupon.name = await generateCouponCode();
                couponArray.push(blankCoupon);
            }
        }
        let finalCouponsArray = [];
        for (let index = 0; index < req.body.count; index++) {
            const element = Math.floor(Math.random() * couponArray.length);
            let couponData = couponArray[element];
            couponData.maximumNoOfUsersAllowed = 1;
            couponData.productId = req.body.productId;
            couponData.productName = productObj.name;
            // await new Coupon(couponData).save()
            finalCouponsArray.push(couponData);
            couponArray.splice(element, 1);
        }

        console.log(finalCouponsArray, "COUPON_MULTIPLE_ADD_SUCCESS");
        let result = await Coupon.insertMany(finalCouponsArray);
        let tempArr = _.cloneDeep(result);

        res.status(200).json({ message: "Coupon Added", data: [...tempArr], success: true });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

export const applyCoupon = async (req, res, next) => {
    try {
        let findArr = [];

        if (mongoose.isValidObjectId(req.params.id)) {
            findArr = [{ _id: req.params.id }, { name: req.params.id }];
        } else {
            findArr = [{ name: req.params.id }];
        }
        let CouponObj = await Coupon.findOne({ $or: [...findArr] })
            .lean()
            .exec();
        let UserObj = await Users.findById(req.user.userId).lean().exec();
        if (!CouponObj) {
            throw new Error("Coupon not found");
        }

        if (CouponObj.maximumNoOfUsersAllowed !== 1) {
            throw new Error("Coupon is already applied");
        }
        await Coupon.findByIdAndUpdate(CouponObj._id, { maximumNoOfUsersAllowed: 0 }).exec();
        let points = CouponObj.value;

        if (CouponObj.value !== 0) {
            let pointDescription = "Coupon Earned " + points + " Points";
            await createPointlogs(req.user.userId, points, pointTransactionType.CREDIT, pointDescription, "success");
            let userPoints = {
                points: UserObj.points + parseInt(points),
            };
            console.log(userPoints);
            await Users.findByIdAndUpdate(req.user.userId, userPoints).exec();

            res.status(200).json({ message: "Coupon Applied", success: true, points: CouponObj.value });
        } else {
            res.status(200).json({ message: "Coupon Applied better luck next time", success: true, points: CouponObj.value });
        }
    } catch (err) {
        console.error(err);
        next(err);
    }
};
