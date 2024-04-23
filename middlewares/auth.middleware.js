import jwt from "jsonwebtoken";
import User from "../models/user.model";

export const authorizeJwt = async (req, res, next) => {
    const authorization = req.headers["authorization"];
    const token = authorization && authorization.split("Bearer ")[1];

    if (!token) return next(); // No token, move to the next middleware

    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
        req.user = decoded;

        // Fetch user object
        const userObj = await User.findById(decoded.userId).exec();

        if (!userObj || !userObj.isActive) {
            return res.status(202).json({ message: "Admin locked you out of the app" });
        }
        req.user.userObj = userObj;

        next();
    } catch (error) {
        // Handle JWT verification errorspos
        console.error("JWT verification error:", error);
        return res.status(401).json({ message: "Unauthorized" });
    }
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
