import jwt from "jsonwebtoken";
import User from "../models/user.model";
import * as serviceAccount from "./serviceAccountKey.json";
import admin from "firebase-admin";

export const authorizeJwt = async (req, res, next) => {
    let authorization = req.headers["authorization"];
    let token = authorization && authorization.split("Bearer ")[1];

    // Check if a token is present
    if (!token) {
        next();
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
        req.user = decoded;
        req.user.userObj = await User.findById(decoded.userId).exec();

        // Check if the user is active
        if (!(req.user.userObj && req.user.userObj.isActive)) {
            res.status(202).json({ message: "Admin Locked you out of the app" });
            return;
        }

        // Check if the access token is about to expire
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const expiresIn = decoded.exp - currentTimestamp;

        if (expiresIn < process.env.JWT_REFRESH_THRESHOLD) {
            // Access token is about to expire, check for the refresh token
            const refreshToken = localStorage.getItem("token");

            if (refreshToken) {
                try {
                    // Verify the refresh token
                    const refreshDecoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_TOKEN_SECRET);

                    // Issue a new access token
                    const newAccessToken = jwt.sign({ userId: refreshDecoded.userId, name: refreshDecoded.name }, process.env.JWT_ACCESS_TOKEN_SECRET, { expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRATION });

                    // Update req.user and response headers with the new access token
                    req.user = {
                        userId: refreshDecoded.userId,
                        name: refreshDecoded.name,
                    };

                    if (refreshDecoded.userId) {
                        req.user.userObj = await User.findById(refreshDecoded.userId).exec();
                    }

                    res.set("Authorization", `Bearer ${newAccessToken}`);
                } catch (refreshError) {
                    return res.status(401).json({ message: "Invalid Refresh Token" });
                }
            } else {
                return res.status(401).json({ message: "Access Token Expired and No Refresh Token" });
            }
        }

        next();
    } catch (e) {
        // Handle token verification errors
        next();
    }
};

export const authorizeJwt1 = async (req, res, next) => {
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
