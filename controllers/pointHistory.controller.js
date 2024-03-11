import pointHistory from "../models/pointHistory.model";
import { pointTransactionType } from "../helpers/Constants";
import Users from "../models/user.model";
import Coupon from "../models/Coupons.model";
import mongoose from "mongoose";
import userModel from "../models/user.model";

export const createPointlogs = async (userId, amount, type, description, mobileDescription, status = "pending", additionalInfo = {}) => {
    let historyLog = {
        transactionId: new Date().getTime().toString(),
        userId: userId,
        amount: amount,
        type: type,
        description: description,
        mobileDescription: mobileDescription,
        status: status,
        additionalInfo: additionalInfo,
    };

    try {
        const savedLog = await new pointHistory(historyLog).save();
        console.log("Point history saved successfully:", savedLog);
    } catch (err) {
        console.error("Error saving point history:", err.message);
    }
};

export const getPointHistory = async (req, res, next) => {
    try {
        let limit = 0;
        let page = 0;
        let sort = {};
        let query = {};

        if (req.query.limit && req.query.limit > 0) {
            limit = parseInt(req.query.limit);
        }

        if (req.query.page && req.query.page > 0) {
            page = parseInt(req.query.page - 1);
        }

        if (req.query.type && pointTransactionType.includes(req.query.type)) {
            query.type = req.query.type;
        }

        if (req.query.status) {
            query.status = req.query.status;
        }

        if (req.query.userId) {
            query.userId = new mongoose.Types.ObjectId(req.query.userId);
        }

        if (req.query.q && req.query.q != "") {
            query.transactionId = { $regex: ".*" + req.query.q + ".*" };
        }

        let pointHistoryArr = [];
        console.log(query, "points-history");

        let pipeline = [
            {
                $match: query,
            },
            {
                $addFields: {
                    origionalId: "$_id",
                },
            },
            {
                $sort: {
                    createdAt: -1,
                },
            },
            {
                $skip: page * limit,
            },
            {
                $limit: limit,
            },
        ];

        if (req.query.transactions) {
            // If you want to include additionalInfo, modify the pipeline
            pipeline.push({
                $project: {
                    _id: "$origionalId",
                    transactionId: "$transactionId",
                    userId: "$userId",
                    amount: "$amount",
                    description: "$description",
                    mobileDescription: "$mobileDescription",
                    type: "$type",
                    status: "$status",
                    createdAt: "$createdAt",
                    updatedAt: "$updatedAt",
                    origionalId: "$origionalId",
                    additionalInfo: "$additionalInfo",
                },
            });
        }

        console.log(JSON.stringify(pipeline, null, 2), "pipeline");

        pointHistoryArr = await pointHistory.aggregate(pipeline);

        for (let pointHistory of pointHistoryArr) {
            let UserObj = await Users.findById(pointHistory.userId).lean().exec();
            pointHistory.user = UserObj;
        }

        res.status(200).json({ message: "List of points history", data: pointHistoryArr, limit: limit, page: page + 1, success: true });
    } catch (err) {
        next(err);
    }
};

export const getPointHistoryMobile = async (req, res, next) => {
    try {
        let query = {};

        if (req.query.userId) {
            query.userId = req.query.userId;
        }

        let pointHistoryArr = await pointHistory.find(query).sort({ createdAt: -1 }).lean().exec();

        res.status(200).json({ message: "List of points history", data: pointHistoryArr, success: true });
    } catch (err) {
        next(err);
    }
};
// export const getPointHistoryMobile = async (req, res, next) => {
//     try {
//         let limit = 10;
//         let page = 0;
//         let sort = {};
//         let query = {};
//         if (req.query.limit && req.query.limit > 0) {
//             limit = parseInt(req.query.limit);
//         }

//         if (req.query.page && req.query.page > 0) {
//             page = parseInt(req.query.page);
//         }
//         if (req.query.userId) {
//             query.userId = req.query.userId;
//         }

//         let pointHistoryArr = await pointHistory
//             .find(query, {}, { skip: page * limit, limit: limit })
//             .sort({ createdAt: -1 })
//             .lean()
//             .exec();

//         res.status(200).json({ message: "List of points history", data: pointHistoryArr, limit: limit, page: page + 1, success: true });
//     } catch (err) {
//         next(err);
//     }
// };

export const pointsRedeem = async (req, res, next) => {
    try {
        let userObj = await Users.findById(req.user.userId).exec();
        let points = req.body.points;
        if (!points || points <= 0) {
            throw new Error("Points must be greater than zero");
        }
        if (userObj.points < req.body.points) {
            throw new Error("You do not have enough points !!!");
        }

        if (!req.body.type) {
            throw new Error("Transfer type  required like UPI or Bank");
        }

        if (!req.body.transferDetails) {
            throw new Error("Tranfer Details are required");
        }

        let additionalInfo = {
            transferType: req.body.type,
            transferDetails: {
                ...req.body.transferDetails,
            },
        };

        let pointDescription = points + " Points are redeem from " + req.body.type + " Transfer";
        let mobileDescription = req.body.type;
        let userPoints = {
            points: userObj.points - parseInt(points),
        };

        await Users.findByIdAndUpdate(req.user.userId, userPoints).exec();
        if (req.body.type && req.body.type == "CASH") {
            let CouponObj = {
                value: points,
                name: "TNP" + Math.floor(Date.now() / 1000) + (Math.random() + 1).toString(36).substring(7),
                maximumNoOfUsersAllowed: 1,
            };
            additionalInfo.transferDetails.couponCode = CouponObj.name;
            let CouponRes = await new Coupon(CouponObj).save();
            res.status(200).json({ message: "Points successfully cashed", success: true, data: CouponRes });
        } else {
            res.status(200).json({ message: "Points successfully redeem", success: true });
        }
        console.log(additionalInfo, "additionalInfo");
        await createPointlogs(req.user.userId, points, pointTransactionType.DEBIT, pointDescription, mobileDescription, "pending", additionalInfo);
    } catch (err) {
        next(err);
    }
};

export const updatePointHistoryStatus = async (req, res, next) => {
    try {
        console.log(req.params, "params");
        let pointHistoryObj = await pointHistory.findById(req.params.id).exec();
        if (!pointHistoryObj) {
            throw new Error("Transaction Not found");
        }

        if (req.body.status == "reject") {
            console.log(pointHistoryObj.userId, "pointHistoryObj.userId");
            let userObj = await userModel.findById(pointHistoryObj.userId).exec();
            if (!userObj) {
                throw new Error("User not found");
            }
            await userModel.findByIdAndUpdate(userObj._id, { $set: { points: userObj.points + pointHistoryObj.amount } }).exec();
            let mobileDescription = "Rejection";
            await createPointlogs(
                pointHistoryObj.userId,
                pointHistoryObj.amount,
                pointTransactionType.CREDIT,
                `Points returned due to rejection of transaction by admin because ${req.body.reason}`,
                mobileDescription,
                "success",
                req.body.reason
            );
        }

        await pointHistory.findByIdAndUpdate(req.params.id, { status: req.body.status, reason: req.body.reason }).exec();

        res.status(201).json({ message: "Transaction Status Updated Successfully", success: true });
    } catch (err) {
        next(err);
    }
};
