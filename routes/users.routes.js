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
} from "../controllers/users.controller";
import { authorizeJwt } from "../middlewares/auth.middleware";
import { sendNotificationMiddleware } from "../middlewares/fcm.middleware";

let router = express.Router();

router.post("/google-signIn", googleLogin);
router.post("/register", registerUser);
router.post("/logout", userLogOut);
router.post("/login", login);
router.post("/checkPhoneNumber", checkPhoneNumber);
router.patch("/updateUserStatus/:id", updateUserStatus);
router.patch("/updateUserKycStatus/:id", updateUserKycStatus);
router.patch("/update-profile", authorizeJwt, sendNotificationMiddleware, updateUserProfile);
router.patch("/update-profile-image", authorizeJwt, updateUserProfileImage);
router.get("/getAllCaprenterByContractorName", authorizeJwt, getAllCaprenterByContractorName);
router.get("/getUserStatsReport/:id", getUserStatsReport);
router.get("/getUsers", getUsers);
router.get("/getContractors", getContractors);
router.get("/getUserById/:id", authorizeJwt, getUserById);
router.get("/getUserContests", getUserContests);
router.delete("/deleteById/:id", deleteUser);

//admin =
router.post("/registerAdmin", registerAdmin);
router.post("/loginAdmin", loginAdmin);
// //
// //total--customer
// router.get("/totalCustomer", getTotalCustomer);
// //active customer
// router.get("/activeCustomer", getActiveCustomer);
export default router;
