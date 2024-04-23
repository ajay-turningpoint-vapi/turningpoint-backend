import { UserList } from "../Builders/user.builder";
import { comparePassword, encryptPassword } from "../helpers/Bcrypt";
import { ErrorMessages, rolesObj } from "../helpers/Constants";
import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import { generateAccessJwt } from "../helpers/Jwt";
import { ValidateEmail, validNo } from "../helpers/Validators";
import Users from "../models/user.model";
import UserContest from "../models/userContest";
import Contest from "../models/contest.model";
import pointHistoryModel from "../models/pointHistory.model";
import admin from "../helpers/firebase";
import ReelLikes from "../models/reelLikes.model";
import { MongoServerError } from "mongodb";
import { createPointlogs } from "./pointHistory.controller";
import { sendNotification, sendNotificationMessage, sendSingleNotificationMiddleware } from "../middlewares/fcm.middleware";
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
                req.body.kycStatus = "submitted";
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
        if (err instanceof MongoServerError && err.code === 11000) {
            return res.status(400).json({ message: "Email Already Exists", success: false });
        }
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
        res.status(201).json({ message: "User Active Status Updated Successfully", success: true });
        next();

        if (status === false) {
            const title = "🛑 Attention: Profile Disabled by Admin";
            const body = `Uh-oh! It appears that your profile has been temporarily disabled by the admin. 🚫 We understand that this may come as a surprise, but rest assured, we're here to help! Please reach out to our support team for assistance and clarification on why your profile was disabled. We're committed to resolving any issues and ensuring that you have the best experience possible. Thank you for your understanding and cooperation.`;

            await sendNotificationMessage(userId, title, body);
        } else {
            const title = "🌟 Congratulations! Your Profile is Approved!";
            const body = `🎉 Great news! Your profile has been approved by the admin! 🚀 Welcome aboard! You're now part of our vibrant community, where exciting opportunities await you. 🌈 Explore, connect, and make the most of your experience with us! Thank you for joining us on this journey. Let's create amazing moments together! ✨`;

            await sendNotificationMessage(userId, title, body);
        }
    } catch (err) {
        next(err);
    }
};

export const updateUserKycStatus = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { kycStatus } = req.body;
        const userObj = await Users.findById(userId).exec();
        if (!userObj) {
            return res.status(404).json({ message: "User not found", success: false });
        }
        await Users.findByIdAndUpdate(userId, { kycStatus: kycStatus }).exec();
        res.status(201).json({ message: "User KYC Status Updated Successfully", success: true });
        next();
        if (kycStatus === "approved") {
            const title = "🎉 Congratulations! Your KYC is Approved!";
            const body = `👏 Hooray! We're excited to announce that your KYC (Know Your Customer) verification has been successfully approved! 🎉 Get ready to unlock a world of exciting opportunities, including exclusive lucky draws, amazing rewards, and much more! 🌟 Thank you for being part of our community, and enjoy the incredible benefits that await you! 🥳`;
            await sendNotificationMessage(userId, title, body);
            next();
        }
        if (kycStatus === "rejected") {
            const title = "🚫 KYC Submission Rejected";
            const body = `Uh-oh! It seems there was an issue with your KYC submission, and it has been rejected. 😔 Don't worry though! Our team is here to help. Please take a moment to review your submission and make any necessary updates. Once you're ready, feel free to resubmit, and we'll do our best to assist you every step of the way! 🛠️ Thank you for your understanding and cooperation.`;
            await sendNotificationMessage(userId, title, body);
            next();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error", success: false });
    }
};

export const updateUserOnlineStatus = async (req, res) => {
    try {
        const { userId } = req.user;
        const { isOnline } = req.body;
        const updatedUser = await Users.findByIdAndUpdate(userId, { isOnline }, { new: true });
        if (!updatedUser) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json({ user: updatedUser });
    } catch (error) {
        console.error("Error updating user activity", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getUsersAnalytics = async (req, res, next) => {
    try {
        // Aggregate the createdAt dates based on month
        const userGroups = await Users.aggregate([
            {
                $match: {
                    role: { $ne: "ADMIN" }, // Exclude users with role ADMIN
                    name: { $ne: "Contractor" }, // Exclude users with name Contractor
                },
            },
            {
                $group: {
                    _id: { $month: "$createdAt" }, // Group by month
                    count: { $sum: 1 }, // Count the number of users in each group
                },
            },
            {
                $sort: { _id: 1 }, // Sort the results by month
            },
        ]);

        // Create an array to hold the counts of users for each month
        const userCounts = Array.from({ length: 12 }, () => [0]);

        // Populate the counts array with the count values from the aggregation result
        userGroups.forEach((group) => {
            const monthIndex = group._id - 1; // Adjust for zero-based indexing
            userCounts[monthIndex] = [group.count];
        });

        res.status(200).json({ message: "Counts of users grouped by month (excluding ADMINs and Contractors)", data: userCounts, success: true });
    } catch (error) {
        console.error(error);
        next(error);
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

export const getUserActivityAnalysis = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        // Parse start and end dates with default values
        const startDateParsed = startDate ? new Date(startDate) : new Date(0); // Default to Unix epoch start date if not provided
        const endDateParsed = endDate ? new Date(endDate) : new Date(); // Default to current date if not provided
        // Validate date range
        if (startDateParsed > endDateParsed) {
            return res.status(400).json({ success: false, message: "Start date cannot be greater than end date" });
        }

        // Find users with specified criteria and projection
        const users = await Users.find(
            {
                name: { $ne: "Contractor" },
                role: { $ne: "ADMIN" },
                createdAt: { $gte: startDateParsed, $lte: endDateParsed },
            },
            { name: 1, phone: 1, role: 1, isOnline: 1, email: 1, createdAt: 1, fcmToken: 1 }
        );

        // Get the user IDs
        const userIds = users.map((user) => user._id.toString());

        // Aggregate query to count reels liked by each user
        const reelsLikeCounts = await ReelLikes.aggregate([{ $match: { userId: { $in: userIds } } }, { $group: { _id: "$userId", count: { $sum: 1 } } }]);

        // Aggregate query to count contest joins and wins by each user
        const contestCounts = await UserContest.aggregate([
            { $match: { userId: { $in: userIds } } },
            {
                $group: {
                    _id: "$userId",
                    joinCount: { $sum: 1 },
                    winCount: { $sum: { $cond: { if: { $eq: ["$status", "win"] }, then: 1, else: 0 } } },
                },
            },
        ]);

        // Create maps to store the counts of reels liked, contest joins, and contest wins for each user
        const reelsLikeCountMap = new Map(reelsLikeCounts.map((count) => [count._id.toString(), count.count]));
        const contestJoinCountMap = new Map(contestCounts.map((count) => [count._id.toString(), count.joinCount]));
        const contestWinCountMap = new Map(contestCounts.map((count) => [count._id.toString(), count.winCount]));

        // Format the response with the counts of reels liked, contest joins, and contest wins for each user
        const formattedUsers = users.map((user) => ({
            _id: user._id,
            phone: user.phone,
            name: user.name,
            role: user.role,
            email: user.email,
            isOnline: user.isOnline,
            createdAt: user.createdAt,
            fcmToken: user.fcmToken,
            reelsLikeCount: reelsLikeCountMap.get(user._id.toString()) || 0,
            contestJoinCount: contestJoinCountMap.get(user._id.toString()) || 0,
            contestWinCount: contestWinCountMap.get(user._id.toString()) || 0,
        }));

        res.status(200).json({ success: true, data: formattedUsers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch users or get counts for the users" });
    }
};

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

export const getUserContestsReportLose = async (req, res, next) => {
    try {
        if (!req.query.contestId) {
            return res.status(400).json({ message: "contestId query parameter is required" });
        }
        const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
        const limit = parseInt(req.query.limit) || 10; // Default to limit 10 if not provided
        const contestId = req.query.contestId;
        // Your aggregation pipeline code
        const pipeline = [
            {
                $match: {
                    status: "lose",
                    rank: "0",
                    contestId: contestId,
                },
            },
            {
                $group: {
                    _id: { userId: "$userId", contestId: "$contestId" }, // Group by userId and contestId
                    userObj: { $first: "$userObj" }, // Get the userObj details
                    contestObj: { $first: "$contestObj" }, // Get the contestObj details
                    joinCount: { $sum: 1 }, // Count the number of documents for each userId
                },
            },
            {
                $addFields: {
                    userIdObject: { $toObjectId: "$_id.userId" }, // Convert userId to ObjectId
                    contestIdObject: { $toObjectId: "$_id.contestId" }, // Convert contestId to ObjectId
                },
            },
            {
                $lookup: {
                    from: "users", // Users collection
                    localField: "userIdObject",
                    foreignField: "_id",
                    as: "userObj",
                },
            },
            {
                $lookup: {
                    from: "contests", // Contests collection
                    localField: "contestIdObject",
                    foreignField: "_id",
                    as: "contestObj",
                },
            },
            {
                $addFields: {
                    userObj: { $arrayElemAt: ["$userObj", 0] }, // Extract the first element of userObj array
                    contestObj: { $arrayElemAt: ["$contestObj", 0] }, // Extract the first element of contestObj array
                },
            },
            {
                $project: {
                    userObj: 1, // Include userObj field
                    contestObj: 1, // Include contestObj field
                    joinCount: 1, // Include joinCount field
                    rank: "0", // Include rank field
                    status: "lose", // Include status field
                },
            },
            {
                $sort: { "userObj.name": 1 }, // Sort by userObj.name in ascending order
            },
            {
                $skip: (page - 1) * limit, // Skip documents for pagination
            },
            {
                $limit: limit, // Limit the number of documents for pagination
            },
        ];

        // Execute the aggregation pipeline to get the result data
        const result = await UserContest.aggregate(pipeline);

        // Execute another aggregation pipeline to count the distinct userIds
        const distinctCountPipeline = [
            {
                $match: {
                    status: "lose",
                    rank: "0",
                },
            },
            {
                $group: {
                    _id: "$userId", // Group by userId
                },
            },
            {
                $count: "total", // Count the distinct userIds
            },
        ];

        // Execute the distinct count pipeline
        const [{ total }] = await UserContest.aggregate(distinctCountPipeline);

        // Calculate total number of pages
        const totalPage = Math.ceil(total / limit);

        // Respond with the fetched data including page information
        res.status(200).json({ data: result, page, totalPage });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getUserContestsReport = async (req, res, next) => {
    try {
        if (!req.query.contestId) {
            return res.status(400).json({ message: "constestId query parameter is required" });
        }
        const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
        const limit = parseInt(req.query.limit) || 10; // Default to limit 10 if not provided
        const contestId = req.query.contestId;
        // Define match condition based on the search query
        const matchCondition = {
            ...(req.query.q === "winners" ? { status: "win" } : {}),
            contestId: contestId,
        };
        // Your aggregation pipeline code
        const pipeline = [
            {
                $addFields: {
                    userIdObject: { $toObjectId: "$userId" },
                    contestIdObject: { $toObjectId: "$contestId" },
                },
            },
            {
                $lookup: {
                    from: "users", // Users collection
                    localField: "userIdObject",
                    foreignField: "_id",
                    as: "userObj",
                },
            },
            {
                $lookup: {
                    from: "contests", // Contests collection
                    localField: "contestIdObject",
                    foreignField: "_id",
                    as: "contestObj",
                },
            },
            {
                $addFields: {
                    userObj: { $arrayElemAt: ["$userObj", 0] }, // Extract the first element of userObj array
                    contestObj: { $arrayElemAt: ["$contestObj", 0] }, // Extract the first element of contestObj array
                },
            },
            {
                $match: matchCondition, // Conditionally match based on search query
            },
            {
                $project: {
                    userIdObject: 0, // Exclude userIdObject field from output
                    contestIdObject: 0, // Exclude contestIdObject field from output
                },
            },
            {
                $sort: { "userObj.name": 1 }, // Sort by userObj.name in ascending order
            },
        ];

        // Execute the aggregation pipeline
        const [result, totalCount] = await Promise.all([
            UserContest.aggregate(pipeline)
                .skip((page - 1) * limit)
                .limit(limit),
            UserContest.countDocuments(matchCondition), // Count documents based on match condition
        ]);

        // Calculate total number of pages
        const totalPage = Math.ceil(totalCount / limit);

        // Respond with the fetched data including page information
        res.status(200).json({ data: result, page, totalPage });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getUserContestsJoinCount = async (req, res, next) => {
    try {
        // Aggregate to get distinct users
        const distinctUserContests = await UserContest.aggregate([{ $group: { _id: "$userId" } }]);
        let totalJoinCount = 0;
        // Iterate through the distinct user contests and calculate total join count
        for (const userContest of distinctUserContests) {
            const userJoinCount = await UserContest.countDocuments({ userId: userContest._id });
            totalJoinCount += userJoinCount;
        }

        res.status(200).json({
            message: "Total Join Count",
            totalJoinCount: totalJoinCount,
            success: true,
        });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getUserContests = async (req, res, next) => {
    try {
        // Pagination parameters
        let page = parseInt(req.query.page) || 1;
        let pageSize = parseInt(req.query.pageSize) || 10;

        // Search parameters
        let searchQuery = {};
        let rank = parseInt(req.query.q);
        if (!isNaN(rank)) {
            searchQuery.rank = rank;
        } else {
            // Search based on username or contest name
            const q = req.query.q;
            if (q) {
                const users = await Users.find({ name: { $regex: q, $options: "i" } }, "_id").exec();
                const contests = await Contest.find({ name: { $regex: q, $options: "i" } }, "_id").exec();
                searchQuery.$or = [{ userId: { $in: users.map((user) => user._id) } }, { contestId: { $in: contests.map((contest) => contest._id) } }];
            }
        }

        // Find user contests based on search query and pagination
        let userContests = await UserContest.find(searchQuery).lean().exec();

        // Populate userObj and contestObj in batches
        await Promise.all(
            userContests.map(async (contest) => {
                if (contest.userId) {
                    contest.userObj = await Users.findById(contest.userId).exec();
                }
                if (contest.contestId) {
                    contest.contestObj = await Contest.findById(contest.contestId).exec();
                }
            })
        );

        // Group user contests by user name in ascending order
        const groupedUserContests = userContests.reduce((acc, curr) => {
            const userName = curr.userObj ? curr.userObj.name : "";
            acc[userName] = [...(acc[userName] || []), curr];
            return acc;
        }, {});

        // Flatten the grouped user contests
        userContests = Object.values(groupedUserContests).flat();

        // Sort user contests by rank (descending)
        userContests.sort((a, b) => {
            // Convert rank to integers
            const rankA = parseInt(a.rank);
            const rankB = parseInt(b.rank);

            // If either rank is 0, push it to the end
            if (rankA === 0 && rankB !== 0) {
                return 1;
            } else if (rankA !== 0 && rankB === 0) {
                return -1;
            } else {
                // Otherwise, sort by rank (descending)
                return rankB - rankA;
            }
        });

        const userContestCounts = new Map();
        for (const contest of userContests) {
            const key = `${contest.userId}_${contest.contestId}`;
            userContestCounts.set(key, (userContestCounts.get(key) || 0) + 1);
        }

        // Add join count to each contest object in the array
        for (const contest of userContests) {
            const key = `${contest.userId}_${contest.contestId}`;
            contest.joinCount = userContestCounts.get(key);
        }

        // Paginate the result
        const totalCount = userContests.length;
        const totalPages = Math.ceil(totalCount / pageSize);
        const paginatedData = userContests.slice((page - 1) * pageSize, page * pageSize);

        // Send response
        res.status(200).json({
            message: "User Contest",
            data: paginatedData,
            page: page,
            limit: pageSize,
            totalCount: totalCount,
            totalPages: totalPages,
            success: true,
        });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const testupdate = async (req, res) => {
    try {
        // Update operation
        const update = { $set: { rank: "0", status: "join" } };

        // Update options
        const options = { multi: true };

        // Perform the update for all documents
        const result = await UserContest.updateMany({}, update, options);

        res.json({ message: "Update successful", result });
    } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getPointHistoryByUserId = async (req, res) => {
    try {
        let query = {}; // Initialize an empty query object

        // Check if userId query parameter exists
        if (!req.query.userId) {
            return res.status(400).json({ error: "userId parameter is required" });
        }
        query.userId = req.query.userId; // Add userId to the query

        // Check if the query parameter s is present and equals "ReelsLike"
        if (req.query.s && req.query.s === "ReelsLike") {
            // If s=ReelsLike, add additional filter to the query for description
            (query.type = "CREDIT"), (query.description = { $regex: "liking a reel", $options: "i" });
        }

        // Check if the query parameter s is present and equals "Contest"
        if (req.query.s && req.query.s === "Contest") {
            // If s=Contest, add additional filter to the query for description
            (query.type = "DEBIT"), (query.status = { $nin: ["reject", "pending"] });
            query.description = { $regex: "Contest Joined", $options: "i" };
        }

        // Check if the query parameter s is present and equals "Scan"
        if (req.query.s && req.query.s === "Coupon") {
            // If s=Scan, add additional filter to the query for description
            query.type = "CREDIT";
            query.description = { $regex: "Coupon Earned", $options: "i" };
        }

        // Check if the query parameter s is present and equals "Redem"
        if (req.query.s && req.query.s === "Redeem") {
            // If s=Redem, add additional filter to the query for description
            query.type = "DEBIT";
            query.status = { $nin: ["reject", "pending"] };
        }

        // Pagination parameters
        let page = parseInt(req.query.page) || 1;
        let pageSize = parseInt(req.query.pageSize) || 10;

        // Find total count of documents matching the query
        const totalCount = await pointHistoryModel.countDocuments(query);

        // Calculate total pages based on total count and page size
        const totalPages = Math.ceil(totalCount / pageSize);

        // Find documents based on the query with pagination
        const pointHistoryData = await pointHistoryModel
            .find(query)
            .skip((page - 1) * pageSize) // Skip documents based on pagination
            .limit(pageSize) // Limit the number of documents per page
            .exec();

        res.json({ data: pointHistoryData, totalPages, success: true, page, totalPages, totalCount, message: "User point history" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
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
