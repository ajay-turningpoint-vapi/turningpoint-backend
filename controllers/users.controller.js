import { UserList } from "../Builders/user.builder";
import { comparePassword, encryptPassword } from "../helpers/Bcrypt";
import { ErrorMessages, rolesObj } from "../helpers/Constants";
import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import { generateAccessJwt } from "../helpers/Jwt";
import { ValidateEmail, validNo } from "../helpers/Validators";
import Users from "../models/user.model";
import UserContest from "../models/userContest";
import Contest from "../models/contest.model";

import mongoose from "mongoose";
import pointHistoryModel from "../models/pointHistory.model";
import admin from "../helpers/firebase";
import { createPointlogs } from "./pointHistory.controller";
import { sendNotification, sendSingleNotificationMiddleware } from "../middlewares/fcm.middleware";
import Geofence from "../models/geoFence.modal";
const geolib = require("geolib");
export const googleLogin = async (req, res) => {
    try {
        const { idToken, fcmToken } = req.body;
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid, name, email, picture } = decodedToken;

        // Find user by matching both uid and phone
        const existingUser = await Users.findOne({ uid: uid });

        if (existingUser) {
            // Check if the UID matches the user's UID
            if (existingUser.uid !== uid) {
                throw { status: 400, message: "GoogleId or phone number do not match" };
            }

            let accessToken = await generateAccessJwt({
                userId: existingUser?._id,
                role: existingUser?.role,
                name: existingUser?.name,
                phone: existingUser?.phone,
                email: existingUser?.email,
            });
            existingUser.fcmToken = fcmToken;
            await existingUser.save();
            res.status(200).json({ message: "LogIn Successful", status: true, token: accessToken });
        } else {
            res.status(200).json({ message: "User not registered", status: false });
        }
    } catch (error) {
        console.error(error);
        if (error.status) {
            res.status(error.status).json({ error: error.message, status: false });
        } else {
            res.status(500).json({ error: "Internal Server Error", status: false });
        }
    }
};

// Registration endpoint

export const registerUser = async (req, res, next) => {
    try {
        let userExistCheck = await Users.findOne({ $or: [{ phone: req.body.phone }, { email: new RegExp(`^${req.body.email}$`) }] });
        if (userExistCheck) {
            throw new Error(`${ErrorMessages.EMAIL_EXISTS} or ${ErrorMessages.PHONE_EXISTS}`);
        }
        if (!validNo.test(req.body.phone)) {
            throw { status: false, message: `Please fill a valid phone number` };
        }
        const { idToken } = req.body;
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid, name, email, picture } = decodedToken;
        const { refCode } = req.body;
        if (refCode) {
            // Find the user with the provided referral code
            const referrer = await User.findOne({ refCode });
            if (referrer) {
                // Add referral logic here - increase points for the referrer, etc.
                referrer.points += 100;
                await createPointlogs(referrer._id, 100, pointTransactionType.CREDIT, `Accumulate 100 points by inviting others through a referral`, "Referral", "success");
                await referrer.save();
            }
        }
        console.log("req", req.body);
        let newUser = await new Users({
            ...req.body,
            uid,
            name,
            email,
            image: picture,
        }).save();
        let accessToken = await generateAccessJwt({
            userId: newUser?._id,
            phone: newUser?.phone,
            email: newUser?.email,
        });
        res.status(200).json({ message: "User Created", data: newUser, token: accessToken, status: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};
export const userLogOut = async (req, res) => {
    const token = req.headers.authorization.split(" ")[1];
    try {
        const decodedToken = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
        const userId = decodedToken.id;
        const user = await Users.findById(userId);
        if (user) {
            user.tokens = user.tokens.filter((t) => t !== token);
            await user.save();
        }
        res.json({ message: "Logout successful" });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ message: "Logout failed" });
    }
};

export const checkPhoneNumber = async (req, res, next) => {
    try {
        const { phone } = req.body;

        // Check if the phone number exists
        const user = await Users.findOne({ phone });
        const phoneNumberExists = !!user;

        if (phoneNumberExists) {
            res.status(200).json({ exists: true, message: "Phone number is already registered." });
        } else {
            res.status(200).json({ exists: false, message: "Phone number is not registered. You can proceed with registration." });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred while checking the phone number." });
        next(error);
    }
};

// export const registerUser = async (req, res, next) => {
//     try {
//         let UserExistCheck = await Users.findOne({ $or: [{ phone: req.body.phone }, { email: new RegExp(`^${req.body.email}$`) }] });
//         if (UserExistCheck) throw new Error(`${ErrorMessages.EMAIL_EXISTS} or ${ErrorMessages.PHONE_EXISTS}`);
//         if (!validNo.test(req.body.phone)) throw { status: false, message: `Please fill a valid phone number` };
//         let newUser = await new Users(req.body).save();
//         let accessToken = await generateAccessJwt({
//             userId: newUser?._id,
//         });
//         res.status(200).json({ message: "User Created", data: newUser, token: accessToken, status: true });
//     } catch (error) {
//         console.error(error);
//         next(error);
//     }
// };

export const login = async (req, res, next) => {
    try {
        console.log(req.body);
        // const userObj = await Users.findOne({ phone: req.body.phone }).lean().exec();
        const userObj = await Users.findOne({ $or: [{ phone: req.body.phone }, { email: new RegExp(`^${req.body.phone}$`) }] })
            .lean()
            .exec();
        if (!userObj) {
            throw { status: 401, message: "user Not Found" };
        }
        if (!userObj.isActive) {
            throw new Error("Your profile is not approved by admin yet please contact admin.");
        }

        // const passwordCheck = await comparePassword(userObj.password, req.body.password);

        // if (!passwordCheck) {
        //     throw { status: 401, message: "Invalid Password" };
        // }

        let accessToken = await generateAccessJwt({
            userId: userObj?._id,
            role: rolesObj?.USER,
            name: userObj?.name,
            phone: userObj?.phone,
            email: userObj?.email,
        });

        res.status(200).json({ message: "LogIn Successfull", token: accessToken, success: true });
    } catch (err) {
        console.log(err);
        next(err);
    }
};

// Function to calculate distance between user's coordinates and geofence coordinates
const calculateDistance = (userCoordinates, geofenceCoordinates) => {
    return geolib.getDistance({ latitude: userCoordinates[0], longitude: userCoordinates[1] }, { latitude: geofenceCoordinates[1], longitude: geofenceCoordinates[0] });
};

// Controller function for updating user's location and sending notifications to users within geofences
export const location = async (req, res) => {
    const { coordinates } = req.body; // Extract coordinates from the request body
    try {
        const userId = req.user.userId; // Extract user ID from authenticated user
        const user = await Users.findById(userId); // Find user by ID in the database

        // Check if user exists
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Find all geofences
        const allGeofences = await Geofence.find({});
        for (const geofence of allGeofences) {
            // Calculate distance between user's coordinates and geofence coordinates
            const distance = calculateDistance(coordinates, geofence.location.coordinates);
            // Check if user is within the geofence radius
            console.log(geofence.location.coordinates);
            if (distance <= geofence.radius) {
                const swappedCoordinates = [geofence.location.coordinates[1], geofence.location.coordinates[0]];

                const usersToNotify = await Users.find({
                    location: {
                        $geoWithin: {
                            $centerSphere: [swappedCoordinates, geofence.radius / 6371], // Convert radius to radians
                        },
                    },
                });
                // Send notifications to users within the geofence

                for (const user of usersToNotify) {
                    await sendNotification(user.fcmToken, geofence.notificationMessage);
                }
            } else {
                console.log("Outside geofence radius");
            }
        }

        res.status(200).json({ message: "Location updated and notifications sent" });
    } catch (error) {
        console.error("Error handling location update:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// const updatedUser = await Users.findByIdAndUpdate(
//     userId,
//     {
//         $set: {
//             location: { type: "Point", coordinates: coordinates },
//             $inc: { version: 1 },
//         },
//     },
//     { new: true }
// );

export const addGeoFence = async (req, res) => {
    try {
        // Extract data from the request body
        const { name, latitude, longitude, radius, notificationMessage } = req.body;

        // Create a new geofence object
        const newGeofence = new Geofence({
            name: name,
            location: {
                type: "Point",
                coordinates: [longitude, latitude],
            },
            radius: radius,
            notificationMessage: notificationMessage,
        });

        // Save the new geofence to the database
        const savedGeofence = await newGeofence.save();
        // Respond with the saved geofence object
        res.status(201).json({ message: "Added New GeoFence", data: savedGeofence, success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Assuming you have imported the Geofence model at the top of your file

// Define a route to handle DELETE requests to delete a geofence by its ID
export const deletedGeofence = async (req, res) => {
    try {
        const geofenceId = req.params.id;
        const deletedGeofence = await Geofence.findByIdAndDelete(geofenceId);
        if (!deletedGeofence) {
            return res.status(404).json({ error: "Geofence not found" });
        }
        res.json({ message: "Geofence deleted successfully", data: deletedGeofence });
    } catch (err) {
        console.error("Error deleting geofence:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getAllGeofence = async (req, res) => {
    try {
        const geofences = await Geofence.find();
        if (geofences.length === 0) {
            return res.status(404).json({ message: "No geofences found" });
        }
        res.status(201).json({ message: "All GeoFence Found", data: geofences, success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateUserProfile = async (req, res, next) => {
    try {
        let userObj = await Users.findById(req.user.userId).exec();
        if (!userObj) {
            throw new Error("User Not found");
        }
        if (req.body.email) {
            if (!ValidateEmail(req.body.email)) {
                throw new Error(ErrorMessages.INVALID_EMAIL);
            }
        }
        if (req.body.idFrontImage) {
            if (req.body.idFrontImage.split("/")[0] === "furnipart") {
                if (req.body.idFrontImage) {
                    req.body.idFrontImage = await storeFileAndReturnNameBase64(req.body.idFrontImage);
                }

                if (req.body.idBackImage) {
                    req.body.idBackImage = await storeFileAndReturnNameBase64(req.body.idBackImage);
                }
                req.body.kycStatus = false;
            } else {
                req.body.isActive = false;
            }
        } else {
            req.body.isActive = false;
        }

        if (req.body.bankDetails !== null && req.body.bankDetails.length > 0) {
            let bankDetails = [
                {
                    banktype: req.body.bankDetails[0].banktype,
                    accountName: req.body.bankDetails[0].accountName,
                    accountNo: req.body.bankDetails[0].accountNo,
                    ifsc: req.body.bankDetails[0].ifsc,
                    // bank: req.body.bankDetails[0].bank,
                },
            ];
            req.body.bankDetails = bankDetails;
        }

        userObj = await Users.findByIdAndUpdate(req.user.userId, req.body).exec();
        res.status(200).json({ message: "Profile Updated Successfully", data: userObj, success: true });
    } catch (err) {
        next(err);
    }
};
export const updateUserProfileImage = async (req, res, next) => {
    try {
        let userObj = await Users.findById(req.user.userId).exec();
        if (!userObj) {
            throw new Error("User Not found");
        }
        if (req.body.image) {
            req.body.image = await storeFileAndReturnNameBase64(req.body.image);
        }
        userObj = await Users.findByIdAndUpdate(req.user.userId, req.body).exec();
        res.status(200).json({ message: "Profile Image Updated Successfully", success: true });
    } catch (err) {
        next(err);
    }
};

// routes/updateUserStatus.js
export const updateUserStatus = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { status } = req.body;

        let userObj = await Users.findById(userId).exec();
        if (!userObj) {
            throw new Error("User Not found");
        }

        await Users.findByIdAndUpdate(userId, { isActive: status }).exec();
        // req.body = {
        //     title: "User Status Update",
        //     body: "Your status has been updated successfully.",
        // };
        // await sendSingleNotificationMiddleware(req, res, next);

        res.status(201).json({ message: "User Active Status Updated Successfully", success: true });
    } catch (err) {
        next(err);
    }
};

export const updateUserKycStatus = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { kycStatus } = req.body;
        if (typeof kycStatus !== "boolean") {
            return res.status(400).json({ message: "Invalid status value. Status must be a boolean.", success: false });
        }
        const userObj = await Users.findById(userId).exec();
        if (!userObj) {
            return res.status(404).json({ message: "User not found", success: false });
        }
        await Users.findByIdAndUpdate(userId, { kycStatus: kycStatus }).exec();
        res.status(201).json({ message: "User KYC Status Updated Successfully", success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error", success: false });
    }
};
export const getUsers = async (req, res, next) => {
    try {
        const UsersPipeline = UserList(req.query);
        let UsersArr = await Users.aggregate(UsersPipeline);
        // let UserObj = await Users.find();
        UsersArr = UsersArr.filter((el) => el.role != rolesObj.ADMIN);
        res.status(200).json({ message: "Users", data: UsersArr, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getContractors = async (req, res, next) => {
    try {
        const currentContractorEmail = req.body.email;

        const UsersPipeline = UserList(req.query);

        UsersPipeline.push({
            $match: {
                role: rolesObj.CONTRACTOR,
                email: { $ne: currentContractorEmail },
            },
        });

        UsersPipeline.push({
            $sort: {
                name: 1,
            },
        });
        let UsersArr = await Users.aggregate(UsersPipeline);

        const namesAndShopNames = UsersArr.map((user) => ({ name: user.name, businessName: user.businessName }));

        res.status(200).json({ message: "Contractors", data: namesAndShopNames, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

// export const getContractors = async (req, res, next) => {
//     try {
//         console.log(req.query);
//         const UsersPipeline = UserList(req.query);
//         UsersPipeline.push({
//             $match: {
//                 role: rolesObj.CONTRACTOR,
//             },
//         });
//         let UsersArr = await Users.aggregate(UsersPipeline);
//         const namesAndShopNames = UsersArr.map((user) => ({ name: user.name, businessName: user.businessName }));

//         res.status(200).json({ message: "Contractors", data: namesAndShopNames, success: true });
//     } catch (error) {
//         console.error(error);
//         next(error);
//     }
// };

// export const getContractors = async (req, res, next) => {
//     try {
//         console.log(req.query);
//         const UsersPipeline = UserList(req.query);
//         UsersPipeline.push({
//             $match: {
//                 role: rolesObj.CONTRACTOR,
//             }
//         });
//         let UsersArr = await Users.aggregate(UsersPipeline);
//         console.log(UsersArr);

//         res.status(200).json({ message: "Contractors", data: UsersArr, success: true });
//     } catch (error) {
//         console.error(error);
//         next(error);
//     }
// };

export const getUserById = async (req, res, next) => {
    try {
        let userObj = await Users.findById(req.params.id).lean().exec();
        if (!userObj) {
            return res.status(404).json({ message: "User not found", success: false });
        }
        let contestParticipationCount = await UserContest.find({ userId: userObj._id }).count().exec();
        let contestsParticipatedInCount = await UserContest.find({ userId: userObj._id }).distinct("contestId").exec();
        let contestUniqueWonCount = await UserContest.find({ userId: userObj._id, status: "win" }).distinct("contestId").exec();
        let contestWonCount = await UserContest.find({ userId: userObj._id, status: "win" }).count().exec();
        userObj.contestParticipationCount = contestParticipationCount;
        userObj.contestsParticipatedInCount = contestsParticipatedInCount.length;
        userObj.contestWonCount = contestWonCount;
        userObj.contestUniqueWonCount = contestUniqueWonCount?.length ? contestUniqueWonCount?.length : 0;

        res.status(200).json({ message: "User found", data: userObj, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const deleteUser = async (req, res, next) => {
    try {
        let userObj = await Users.findByIdAndRemove(req.params.id).exec();
        if (!userObj) throw { status: 400, message: "user not found or deleted already" };

        res.status(200).json({ msg: "user deleted successfully", success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

//ADMIN============

export const registerAdmin = async (req, res, next) => {
    try {
        let adminExistCheck = await Users.findOne({ $or: [{ phone: req.body.phone }, { email: new RegExp(`^${req.body.email}$`) }] })
            .lean()
            .exec();
        if (adminExistCheck) throw new Error(`${ErrorMessages.EMAIL_EXISTS} or ${ErrorMessages.PHONE_EXISTS}`);
        if (!ValidateEmail(req.body.email)) {
            throw new Error(ErrorMessages.INVALID_EMAIL);
        }
        req.body.role = rolesObj.ADMIN;
        req.body.password = await encryptPassword(req.body.password);

        let newUser = await new Users(req.body).save();

        res.status(200).json({ message: "admin Created", success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};
export const loginAdmin = async (req, res, next) => {
    try {
        console.log(req.body);
        const adminObj = await Users.findOne({ $or: [{ email: new RegExp(`^${req.body.email}$`) }, { phone: req.body.phone }], role: rolesObj.ADMIN })
            .lean()
            .exec();
        if (adminObj) {
            const passwordCheck = await comparePassword(adminObj.password, req.body.password);
            if (passwordCheck) {
                let accessToken = await generateAccessJwt({ userId: adminObj._id, role: rolesObj.ADMIN, user: { name: adminObj.name, email: adminObj.email, phone: adminObj.phone, _id: adminObj._id } });
                res.status(200).json({ message: "LogIn Successfull", token: accessToken, success: true });
            } else {
                throw { status: 401, message: "Invalid Password" };
            }
        } else {
            throw { status: 401, message: "Admin Not Found" };
        }
    } catch (err) {
        console.log(err);
        next(err);
    }
};
// total customer and active customer

export const getTotalCustomer = async (req, res, next) => {
    try {
        let totalCustomer = 0;
        let arr = await Users.find().exec();
        totalCustomer = arr.length;

        res.status(200).json({ message: "Users-data", data: { totalCustomer: totalCustomer }, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getActiveCustomer = async (req, res, next) => {
    try {
        let arr = await Users.find({ isActive: true }).count().exec();
        res.status(200).json({ message: "Users-data", data: { activeCustomer: arr }, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getUserContests = async (req, res, next) => {
    try {
        let UserContests = await UserContest.find().lean().exec();
        for (let contest of UserContests) {
            if (contest.userId) {
                contest.userObj = await Users.findById(contest.userId).exec();
            }
            if (contest.contestId) {
                contest.contestObj = await Contest.findById(contest.contestId).exec();
            }
        }
        res.status(200).json({ message: "User Contest", data: UserContests, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const testupdate = async (req, res) => {
    try {
        // Find documents with rank 0
        const filter = { rank: "0" }; // Assuming rank is stored as a string, adjust as needed
        // Update all documents with rank 0
        const result = await UserContest.updateMany(filter, { status: "join" }); // Assuming you want to update the status to 'win'

        res.json({ message: "Update successful", result });
    } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getUserStatsReport = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const allTransactions = [
            {
                $match: {
                    userId: userId,
                },
            },
        ];
        const likingReelpipeline = [
            {
                $match: {
                    userId: userId,
                    type: "CREDIT",
                    description: {
                        $regex: "liking a reel",
                        $options: "i",
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$amount" },
                },
            },
        ];
        let totalPointsRedeemedInContestPipeline = [
            {
                $match: {
                    userId: userId,
                    type: "DEBIT",
                    $and: [{ status: { $ne: "reject" } }, { status: { $ne: "pending" } }],
                    description: {
                        $regex: "Contest Joined",
                        $options: "i",
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$amount" },
                },
            },
        ];
        const totalDebitPipeline = [
            {
                $match: {
                    userId: userId,
                    type: "DEBIT",
                    $and: [{ status: { $ne: "reject" } }, { status: { $ne: "pending" } }],
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$amount" },
                },
            },
        ];
        const totalPointsCouponPipeline = [
            {
                $match: {
                    userId: userId,
                    type: "CREDIT",
                    description: {
                        $regex: "Coupon Earned",
                        $options: "i",
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$amount" },
                },
            },
        ];

        const userAllTransactions = await pointHistoryModel.aggregate(allTransactions).exec();
        const likingReel = await pointHistoryModel.aggregate(likingReelpipeline).exec();
        const total = await pointHistoryModel.aggregate(totalPointsRedeemedInContestPipeline).exec();
        const totalCoupoun = await pointHistoryModel.aggregate(totalPointsCouponPipeline).exec();
        const user = await Users.findById(userId).exec();

        if (!user) {
            throw new Error("User not found !!!");
        }
        const totalDebit = await pointHistoryModel.aggregate(totalDebitPipeline).exec();
        const totalPointsRedeemed = user.points - (totalDebit.length > 0 ? totalDebit[0].totalAmount : 0);
        // Construct the response object
        const response = {
            userName: user.name,
            points: user.points,
            totalPointsRedeemed: totalDebit.length > 0 ? totalDebit[0].totalAmount : 0,
            totalPointsRedeemedForProducts: totalCoupoun.length > 0 ? totalCoupoun[0].totalAmount : 0,
            totalPointsRedeemedForLiking: likingReel.length > 0 ? likingReel[0].totalAmount : 0,
            totalPointsRedeemedInContest: total.length > 0 ? total[0].totalAmount : 0,
            userAllTransactions: userAllTransactions,
        };

        res.status(200).json({ message: "User Contest", data: response, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

// export const getUserStatsReport = async (req, res, next) => {
// try {
//     let totalPointsRedeemedPipeline = [
//         {
//             $match: {
//                 userId: new mongoose.Types.ObjectId(req.params.id),
//             },
//         },
//         {
//             $group: {
//                 _id: null,
//                 total: {
//                     $sum: { $toDouble: "$amount" },
//                 },
//             },
//         },
//     ];
//         let totalPointsRedeemedForLikingPipeline = [
//             {
//                 $match: {
//                     userId: new mongoose.Types.ObjectId(req.params.id),
//                     type: "CREDIT",
//                     description: {
//                         $regex: "liking a reel",
//                         $options: "i",
//                     },
//                 },
//             },
//             {
//                 $group: {
//                     _id: null,
//                     total: {
//                         $sum: { $toDouble: "$amount" },
//                     },
//                 },
//             },
//         ];
//         let totalPointsRedeemedForProductsPipeline = [
//             {
//                 $match: {
//                     userId: new mongoose.Types.ObjectId(req.params.id),
//                     type: "CREDIT",
//                     description: {
//                         $not: {
//                             $regex: "liking a reel",
//                             $options: "i",
//                         },
//                     },
//                 },
//             },
//             {
//                 $match: {},
//             },
//             {
//                 $group: {
//                     _id: null,
//                     total: {
//                         $sum: { $toDouble: "$amount" },
//                     },
//                 },
//             },
//         ];
//         let totalPointsRedeemedInCashPipeline = [
//             {
//                 $match: {
//                     userId: new mongoose.Types.ObjectId(req.params.id),
//                     type: "DEBIT",
//                     $and: [{ status: { $ne: "reject" } }, { status: { $ne: "pending" } }],
//                     description: {
//                         $not: {
//                             $regex: "Contest Joined",
//                             $options: "i",
//                         },
//                     },
//                 },
//             },
//             {
//                 $group: {
//                     _id: null,
//                     total: {
//                         $sum: { $toDouble: "$amount" },
//                     },
//                 },
//             },
//         ];
//         let totalPointsRedeemedInContestPipeline = [
//             {
//                 $match: {
//                     userId: new mongoose.Types.ObjectId(req.params.id),
//                     type: "DEBIT",
//                     $and: [{ status: { $ne: "reject" } }, { status: { $ne: "pending" } }],
//                     description: {
//                         $regex: "Contest Joined",
//                         $options: "i",
//                     },
//                 },
//             },
//             {
//                 $group: {
//                     _id: null,
//                     total: {
//                         $sum: { $toDouble: "$amount" },
//                     },
//                 },
//             },
//         ];

//         console.log(
//             JSON.stringify(totalPointsRedeemedPipeline, null, 2),
//             JSON.stringify(totalPointsRedeemedForLikingPipeline, null, 2),
//             JSON.stringify(totalPointsRedeemedForProductsPipeline, null, 2),
//             JSON.stringify(totalPointsRedeemedInCashPipeline, null, 2),
//             JSON.stringify(totalPointsRedeemedInContestPipeline, null, 2)
//         );
//         let totalPointsRedeemed = await pointHistoryModel.aggregate(totalPointsRedeemedPipeline);
//         let totalPointsRedeemedForLiking = await pointHistoryModel.aggregate(totalPointsRedeemedForLikingPipeline);
//         let totalPointsRedeemedForProducts = await pointHistoryModel.aggregate(totalPointsRedeemedForProductsPipeline);
//         let totalPointsRedeemedInCash = await pointHistoryModel.aggregate(totalPointsRedeemedInCashPipeline);
//         let totalPointsRedeemedInContest = await pointHistoryModel.aggregate(totalPointsRedeemedInContestPipeline);
//         let userObj = await Users.findById(req.params.id).exec();
//         if (!userObj) {
//             throw new Error("User not found !!!");
//         }

//         let obj = {
//             userName: userObj?.name,
//             points: userObj?.points,
//             totalPointsRedeemed: totalPointsRedeemed[0]?.total,
//             totalPointsRedeemedForLiking: totalPointsRedeemedForLiking[0]?.total,
//             totalPointsRedeemedForProducts: totalPointsRedeemedForProducts[0]?.total,
//             totalPointsRedeemedInCash: totalPointsRedeemedInCash[0]?.total,
//             totalPointsRedeemedInContest: totalPointsRedeemedInContest[0]?.total,
//         };
//         console.log(obj);

//         res.status(200).json({ message: "User Contest", data: obj, success: true });
//     } catch (error) {
//         console.error(error);
//         next(error);
//     }
// };

export const getAllCaprenterByContractorName = async (req, res) => {
    try {
        const contractors = await Users.find({
            "contractor.businessName": req.user.contractor.businessName,
            "contractor.name": req.user.contractor.name,
        });
        if (contractors.length === 0) {
            return res.status(404).json({ message: "No contractors found " + contractor.businessName });
        }

        // Process the result to group carpenters under the allCarpenters key
        const allCarpenters = contractors.map(({ name, points }) => ({ name, points }));

        // Calculate the total points for all carpenters
        const allCarpentersTotal = allCarpenters.reduce((total, carpenter) => total + carpenter.points, 0);

        // Construct the final result
        const result = {
            contractor: {
                name: contractors[0].contractor.name, // Assuming the name is the same for all contractors
                businessName: contractors[0].contractor.businessName, // Assuming the businessName is the same for all contractors
                allCarpenters,
                allCarpentersTotal,
            },
        };

        res.json(result);
    } catch (error) {
        console.error("Error fetching contractors:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
