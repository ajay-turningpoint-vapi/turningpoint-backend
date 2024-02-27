import jwt from "jsonwebtoken";
import User from "../models/user.model";
import * as serviceAccount from "./serviceAccountKey.json";
import admin from "firebase-admin";

export const authorizeJwt = async (req, res, next) => {
    let authorization = req.headers["authorization"];
    let token = authorization && authorization.split("Bearer ")[1];
    if (!token) next();
    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
        req.user = decoded;
        req.user.userObj = await User.findById(decoded.userId).exec();
        if (!(req.user.userObj.isActive && req.user.userObj)) {
            res.status(202).json({ message: "Admin Locked you out of the app" });
            return;
        }
        next();
    } catch (e) {}
};

export const setUserAndUserObj = async (req, res, next) => {
    let authorization = req.headers["authorization"];
    if (authorization) {
        let token = authorization && authorization.split("Bearer ")[1];
        if (token) {
            try {
                // Verify token
                const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
                // Add user from payload
                req.user = decoded;
                if (decoded.userId) req.user.userObj = await User.findById(decoded.userId).exec();
            } catch (e) {
                return res.status(401).json({ message: "Invalid Token" });
            }
        }
    }
    next();
};
