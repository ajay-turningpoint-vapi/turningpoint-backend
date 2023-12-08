import jwt from "jsonwebtoken";
import User from "../models/user.model";

export const authorizeJwt = async (req, res, next) => {
    console.log(req.headers["authorization"])
    let authorization = req.headers["authorization"];
    let token = authorization && authorization.split("Bearer ")[1];
    if (!token) next();
    try {
        // Verify tokenJWT_ACCESS_TOKEN_SECRET

        const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
        // Add user from payload
        req.user = decoded;

        req.user.userObj = await User.findById(decoded.userId).exec();
        if (!(req.user.userObj.isActive && req.user.userObj)) {
            console.log("this")
            res.status(402).json({ message: "Admin Locked you out of the app" });
        }
        console.log(req.user.userObj, "req.user.userObj")
        next();
    } catch (e) {
        // res.status(401).json({ message: "Token is not valid" });
    }
};

export const setUserAndUserObj = async (req, res, next) => {
    // console.log(req.headers)
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