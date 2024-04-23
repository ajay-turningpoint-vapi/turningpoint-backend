import express from "express";
import {
    deleteUser,
    getUsers,
    login,
    loginAdmin,
    registerAdmin,
    registerUser,
    updateUserStatus,
    updateUserProfile,
    getUserById,
    updateUserProfileImage,
    getUserContests,
    getUserStatsReport,
    getContractors,
    googleLogin,
    updateUserKycStatus,
    checkPhoneNumber,
    getAllCaprenterByContractorName,
    userLogOut,
    gpsData,
    addGeoFence,
    getAllGeofence,
    deletedGeofence,
    location,
    testupdate,
    getPointHistoryByUserId,
    updateUserOnlineStatus,
    getUserContestsReport,
    getUserContestsJoinCount,
    getUserContestsReportLose,
    getUsersAnalytics,
    getUserActivityAnalysis,
} from "../controllers/users.controller";
import { authorizeJwt } from "../middlewares/auth.middleware";
import { sendSingleNotificationMiddleware } from "../middlewares/fcm.middleware";

let router = express.Router();

router.post("/google-signIn", googleLogin);
router.post("/register", registerUser);
router.post("/logout", userLogOut);
router.post("/login", login);
router.post("/checkPhoneNumber", checkPhoneNumber);
router.patch("/updateUserStatus/:id", updateUserStatus);
router.put("/updateStatus", testupdate);
router.patch("/updateUserKycStatus/:id", updateUserKycStatus);
router.patch("/updateUserOnlineStatus", authorizeJwt, updateUserOnlineStatus);
router.patch("/update-profile", authorizeJwt, updateUserProfile);
router.patch("/update-profile-image", authorizeJwt, updateUserProfileImage);
router.get("/getAllCaprenterByContractorName", authorizeJwt, getAllCaprenterByContractorName);
router.get("/getUserStatsReport/:id", getUserStatsReport);
router.get("/getUserPointHistoryById", getPointHistoryByUserId);
router.get("/getUsers", getUsers);
router.get("/getUsersAnalytics", getUsersAnalytics);
router.get("/getUserActivityAnalysis", authorizeJwt, getUserActivityAnalysis);
router.get("/getContractors", getContractors);
router.get("/getUserById/:id", authorizeJwt, getUserById);
router.get("/getUserContests", getUserContests);
router.get("/getUserContestsReport", getUserContestsReport);
router.get("/getUserContestsReportLose", getUserContestsReportLose);
router.get("/getUserContestsCount", getUserContestsJoinCount);
router.delete("/deleteById/:id", deleteUser);
// router.post("/monitor-location", gpsData);
router.patch("/monitor-location", authorizeJwt, location);
router.post("/addGeofence", addGeoFence);
router.delete("/deletedGeofence/:id", deletedGeofence);
router.get("/getAllGeofence", getAllGeofence);
//admin =
router.post("/registerAdmin", registerAdmin);
router.post("/loginAdmin", loginAdmin);
// //
// //total--customer
// router.get("/totalCustomer", getTotalCustomer);
// //active customer
// router.get("/activeCustomer", getActiveCustomer);
export default router;
