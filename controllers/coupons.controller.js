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
import activityLogsModel from "../models/activityLogs.model";
import QRCode from "qrcode";
import XLSX from "xlsx";
import { saveAs } from "file-saver";
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

export const generateCoupon = async (req, res, next) => {
    try {
        // Ensure the request body has the required fields
        if (!req.body.points) {
            throw new Error("Please provide the number of points to generate a coupon.");
        }

        // Check if the user has enough points
        const userObj = await Users.findById(req.user.userId).exec();
        const pointsToGenerate = parseInt(req.body.points);

        if (!userObj || userObj.points < pointsToGenerate) {
            throw new Error("Insufficient points to generate a coupon.");
        }

        // Generate a single coupon
        const couponCode = await generateCouponCode();
        const couponData = {
            name: couponCode,
            value: pointsToGenerate, // You can adjust this based on your requirements
            count: 1,
            maximumNoOfUsersAllowed: 1,
            userId: req.user.userId, // Assuming you want to associate the generated coupon with the user
        };

        // Subtract points from the user
        const updatedUserPoints = userObj.points - pointsToGenerate;
        await Users.findByIdAndUpdate(req.user.userId, { points: updatedUserPoints }).exec();

        // Insert the generated coupon into the database
        const result = await Coupon.create(couponData);
        await createPointlogs(userObj._id, pointsToGenerate, pointTransactionType.DEBIT, `Generate a coupon worth ${pointsToGenerate} points`, "Coupon", "success");
        res.status(200).json({ message: "Coupon Generated", data: result, success: true });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

export const getCouponCount = async (req, res) => {
    try {
        const count = await Coupon.countDocuments();
        res.json(count);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getAllCoupons = async (req, res, next) => {
    try {
        let query = {};
        let page = req.query.page ? parseInt(req.query.page) : 1; // Default to page 1 if not provided
        let pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : 10; // Default page size to 10 if not provided

        if (req.query.couponUsed && req.query.couponUsed != "All") {
            query.maximumNoOfUsersAllowed = parseInt(req.query.couponUsed);
        }
        if (req.query.productId) {
            query.productId = req.query.productId;
        }

        let totalCount = await Coupon.countDocuments(query); // Get total count of documents matching query

        let couponsArr = await Coupon.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * pageSize) // Skip documents based on pagination
            .limit(pageSize) // Limit the number of documents per page
            .lean()
            .exec();

        for (const coupon of couponsArr) {
            if (coupon.productId) {
                coupon.productObj = await productModel.findById(coupon.productId).lean().exec();
            }
        }

        res.status(200).json({
            message: "Found all coupons",
            data: couponsArr,
            page: page,
            limit: pageSize,
            totalPage: Math.ceil(totalCount / pageSize),
            count: totalCount,
            success: true,
        });
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

        // Prepare coupon data for Excel
        const excelData = [];

        for (const coupon of CouponArr) {
            // Generate QR code for coupon
            // const qrDataUrl = await QRCode.toDataURL(String(coupon._id));

            // Add coupon data to Excel data
            excelData.push({
                CouponName: coupon.name,
                CouponCode: coupon.value,
                QRCode: coupon._id, // Store QR code data URL directly
                // Add more fields as needed
            });
        }

        // Create a new worksheet
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Add QR code images to Excel sheet
        for (let i = 0; i < CouponArr.length; i++) {
            const qrDataUrl = excelData[i].QRCode;
            const cellRef = `C${i + 2}`; // Assuming QR code data is in column C

            // Add image data directly to cell
            ws[cellRef] = { t: "s", v: qrDataUrl };
        }

        // Create a new workbook and add the worksheet
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Coupons");

        // Convert workbook to binary Excel file
        const excelBinary = XLSX.write(wb, { type: "binary" });

        // Set response headers for Excel download
        res.setHeader("Content-Disposition", 'attachment; filename="active_coupons.xlsx"');
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        // Send Excel file as response
        res.end(Buffer.from(excelBinary, "binary"));
    } catch (error) {
        console.error(error);
        next(error);
    }
};
export const getActiveCouponsQrZip1 = async (req, res, next) => {
    try {
        let todayStart = new Date();
        todayStart.setHours(0, 0, 0);

        let CouponArr = await Coupon.find({ maximumNoOfUsersAllowed: 1 }).lean().exec();

        let couponsLocationArr = [];
        let couponsNameArr = [];
        for (const el of CouponArr) {
            let qr = await QrGenerator(el._id);
            couponsLocationArr.push(qr.locationVal);
            couponsNameArr.push(qr.fileName);
        }

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

        if (totalAmount > req.body.amount) {
            throw new Error("coupon values and their count must be less than total coupon count");
        }
        if (totalCount > req.body.count) {
            throw new Error("number of coupons must be less than total coupons");
        }
        let couponArray = [];
        let forLoopCouponArray = [];
        for (const coupon of coupons) {
            while (parseInt(coupon.count) !== 0) {
                let newObject = _.cloneDeep(coupon);
                newObject.name = await generateCouponCode();
                couponArray.push(newObject);
                coupon.count = (parseInt(coupon.count) - 1).toString();
            }
        }
        let remainingCoupon = req.body.count - couponArray.length;
        console.log(remainingCoupon);
        if (remainingCoupon > 0) {
            for (let index = 0; index < remainingCoupon; index++) {
                let blankCoupon = { value: 0, count: 0, name: await generateCouponCode() };
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
            finalCouponsArray.push(couponData);
            couponArray.splice(element, 1);
        }
        // console.log(finalCouponsArray, "COUPON_MULTIPLE_ADD_SUCCESS");
        // const totalValueAndCount = finalCouponsArray.reduce(
        //     (acc, coupon) => {
        //         return {
        //             value: acc.value + parseInt(coupon.value),
        //             count: acc.count + parseInt(coupon.count),
        //         };
        //     },
        //     { value: 0, count: 0 }
        // );

        // console.log(req.body.coupons);

        // console.log("forLoopCouponArray", forLoopCouponArray, "length", forLoopCouponArray.length);
        // if (totalValueAndCount.value !== parseInt(req.body.amount) || totalValueAndCount.count !== parseInt(req.body.count)) {
        //     throw new Error("Total value and count mismatch");
        // }

        let result = await Coupon.insertMany(finalCouponsArray);
        let tempArr = _.cloneDeep(result);
        res.status(200).json({ message: "Coupon Added", data: [...tempArr], success: true });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

// export const addMultipleCoupons = async (req, res, next) => {
//     try {
//         if (!req.body.hasOwnProperty("coupons") || req.body.coupons.length == 0) {
//             throw new Error("Please fill coupon values and their count");
//         }

//         let productObj = await productModel.findById(req.body.productId).exec();
//         let coupons = req.body.coupons;
//         let totalCount = 0;
//         let totalAmount = 0;

//         for (const coupon of coupons) {
//             totalCount += parseInt(coupon.count);
//             totalAmount += parseInt(coupon.count * coupon.value);
//         }

//         console.log("TotalAmt", req.body.amount, "TotalCount", req.body.count, "totalCount", totalCount, "totalAmount", totalAmount);
//         if (totalAmount > req.body.amount) {
//             throw new Error("coupon values and their count must be less than total coupon count");
//         }

//         if (totalCount > req.body.count) {
//             throw new Error("number of coupons must be less than total coupons");
//         }
//         let couponArray = [];

//         for (const coupon of coupons) {
//             while (coupon.count != 0) {
//                 let newOBject = { ...coupon };
//                 newOBject.name = await generateCouponCode();
//                 couponArray.push(newOBject);
//                 coupon.count--;
//             }
//         }

//         if (couponArray.length !== req.body.count) {
//             throw new Error("The total count in the coupons array does not match the overall count");
//         }

//         let remainingCoupon = req.body.count - couponArray.length;
//         console.log(remainingCoupon);
//         if (remainingCoupon > 0) {
//             for (let index = 0; index < remainingCoupon; index++) {
//                 let blankCoupon = new Object();
//                 blankCoupon.value = 0;
//                 blankCoupon.count = 0;
//                 blankCoupon.name = await generateCouponCode();
//                 couponArray.push(blankCoupon);
//             }
//         }
//         let finalCouponsArray = [];
//         for (let index = 0; index < req.body.count; index++) {
//             const element = Math.floor(Math.random() * couponArray.length);
//             let couponData = couponArray[element];
//             couponData.maximumNoOfUsersAllowed = 1;
//             couponData.productId = req.body.productId;
//             couponData.productName = productObj.name;
//             // await new Coupon(couponData).save()
//             finalCouponsArray.push(couponData);
//             couponArray.splice(element, 1);
//         }

//         console.log(finalCouponsArray, "COUPON_MULTIPLE_ADD_SUCCESS");
//         let result = await Coupon.insertMany(finalCouponsArray);
//         let tempArr = _.cloneDeep(result);

//         res.status(200).json({ message: "Coupon Added", data: [...tempArr], success: true });
//     } catch (err) {
//         console.error(err);
//         next(err);
//     }
// };

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
            return res.status(700).json({ message: "Coupon not found" });
        }

        if (CouponObj.maximumNoOfUsersAllowed !== 1) {
            return res.status(700).json({ message: "Coupon has already been applied" });
        }
        await Coupon.findByIdAndUpdate(CouponObj._id, { maximumNoOfUsersAllowed: 0 }).exec();
        let points = CouponObj.value;

        if (CouponObj.value !== 0) {
            let pointDescription = "Coupon Earned " + points + " Points By Scanning QRCode";
            let mobileDescription = "Coupon";
            await createPointlogs(req.user.userId, points, pointTransactionType.CREDIT, pointDescription, mobileDescription, "success");
            let userPoints = {
                points: UserObj.points + parseInt(points),
            };
            await activityLogsModel.create({
                userId: req.user.userId,
                type: "Scanned Coupon",
            });

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
