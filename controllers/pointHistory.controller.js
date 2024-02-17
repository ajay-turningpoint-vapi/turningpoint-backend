import pointHistory from "../models/pointHistory.model";
import { pointTransactionType } from "../helpers/Constants";
import Users from "../models/user.model";
import Coupon from "../models/Coupons.model";
import mongoose from "mongoose";
import userModel from "../models/user.model";

export const createPointlogs = async (userId, amount, type, description, status = "pending", additionalInfo = {}) => {
    let historyLog = {
        transactionId: new Date().getTime(),
        userId: userId,
        amount: amount,
        type: type,
        description: description,
        status: status,
        additionalInfo: additionalInfo,
    };

    await new pointHistory(historyLog).save();
};

export const getPointHistory = async (req, res, next) => {
    try {
        let limit = 10;
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
        console.log(query, "query");
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
                $group: {
                    _id: {
                        transactionId: "$transactionId",
                    },
                    transactionId: {
                        $first: "$transactionId",
                    },
                    userId: {
                        $first: "$userId",
                    },
                    amount: {
                        $first: "$amount",
                    },
                    description: {
                        $first: "$description",
                    },
                    type: {
                        $first: "$type",
                    },
                    status: {
                        $first: "$status",
                    },
                    createdAt: {
                        $first: "$createdAt",
                    },
                    updatedAt: {
                        $first: "$updatedAt",
                    },
                    origionalId: {
                        $first: "$origionalId",
                    },
                },
            },
            {
                $addFields: {
                    _id: "$origionalId",
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

        console.log(JSON.stringify(pipeline, null, 2), "pipeline");
        pointHistoryArr = await pointHistory.aggregate(pipeline);
        // if (req.query.transactions) {
        //     console.log('asddfsads----------------------------Tasns');

        //     // query.additionalInfo = { $exists: true, $not: { $size: 0 } };
        // }
        // else {
        //     pointHistoryArr = await pointHistory.find(query, {}, { skip: page * limit, limit: limit }).distinct("transactionId").sort({ createdAt: -1 }).lean().exec();
        // }

        for (let pointHistory of pointHistoryArr) {
            let UserObj = await Users.findById(pointHistory.userId).lean().exec();
            pointHistory.user = UserObj;
        }
        // console.log(pointHistoryArr, "pointHistoryArr")
        res.status(200).json({ message: "List of points history", data: pointHistoryArr, limit: limit, page: page + 1, success: true });
    } catch (err) {
        next(err);
    }
};

export const getPointHistoryMobile = async (req, res, next) => {
    try {
        let limit = 10;
        let page = 0;
        let sort = {};
        let query = {};
        if (req.query.limit && req.query.limit > 0) {
            limit = parseInt(req.query.limit);
        }

        if (req.query.page && req.query.page > 0) {
            page = parseInt(req.query.page);
        }
        if (req.query.userId) {
            query.userId = req.query.userId;
        }

        let pointHistoryArr = await pointHistory
            .find(query, {}, { skip: page * limit, limit: limit })
            .sort({ createdAt: -1 })
            .lean()
            .exec();

        res.status(200).json({ message: "List of points history", data: pointHistoryArr, limit: limit, page: page + 1, success: true });
    } catch (err) {
        next(err);
    }
};

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

        if (!req.body.transferDeatils) {
            throw new Error("Tranfer Details are required");
        }
        let UserObj = await Users.findById(req.user.userId).lean().exec();
        if (!UserObj) {
            throw new Error("User Not Found");
        }
        let additionalInfo = {
            transferType: req.body.type,
            transferDeatils: req.body.transferDeatils,
        };
        let pointDescription = points + " Points are redeem from " + req.body.type + " Transfer";

        let userPoints = {
            points: UserObj.points - parseInt(points),
        };

        await Users.findByIdAndUpdate(req.user.userId, userPoints).exec();
        if (req.body.type && req.body.type == "CASH") {
            let CouponObj = {
                value: points,
                name: "TNP" + Math.floor(Date.now() / 1000) + (Math.random() + 1).toString(36).substring(7),
                maximumNoOfUsersAllowed: 1,
            };
            additionalInfo.transferDeatils.couponCode = CouponObj.name;
            let CouponRes = await new Coupon(CouponObj).save();
            res.status(200).json({ message: "Points successfully cashed", success: true, data: CouponRes });
        } else {
            res.status(200).json({ message: "Points successfully redeem", success: true });
        }
        console.log(additionalInfo, "additionalInfo");
        await createPointlogs(req.user.userId, points, pointTransactionType.DEBIT, pointDescription, "pending", additionalInfo);
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
            await createPointlogs(pointHistoryObj.userId, pointHistoryObj.amount, pointTransactionType.CREDIT, `Points returned due to rejection of transaction by admin because ${req.body.reason}`, "success", req.body.reason);
        }

        await pointHistory.findByIdAndUpdate(req.params.id, { status: req.body.status, reason: req.body.reason }).exec();

        res.status(201).json({ message: "Transaction Status Updated Successfully", success: true });
    } catch (err) {
        next(err);
    }
};
