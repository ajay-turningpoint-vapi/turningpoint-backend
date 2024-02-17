import jwt from "jsonwebtoken";
import User from "../models/user.model";
import * as serviceAccount from "./serviceAccountKey.json";
import admin from "firebase-admin";

// Rest of your code remains the same

// export const authorizeJwt = async (req, res, next) => {
//     let authorization = req.headers["authorization"];
//     let token = authorization && authorization.split("Bearer ")[1];

//     if (!token) {
//         return next(); // No token found, proceed without authentication
//     }

//     try {
//         // Try to verify as Firebase ID token
//         const decodedFirebase = await admin.auth().verifyIdToken(token);
//         req.user = {
//             userId: decodedFirebase.uid,
//             email: decodedFirebase.email,
//             userObj: null, // You may not have user data directly from Firebase, adjust accordingly
//             role: "USER", // Adjust the role based on your logic
//         };
//         next();
//     } catch (firebaseError) {
//         // If it's not a Firebase ID token, try decoding it as a JWT
//         try {
//             const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
//             req.user = decoded;
//             req.user.userObj = await User.findById(decoded.userId).exec();
//             if (!(req.user.userObj.isActive && req.user.userObj)) {
//                 console.log("User is not active");
//                 return res.status(402).json({ message: "Admin locked you out of the app" });
//             }
//             req.user.role = "ADMIN";
//             console.log(req.user.userObj, "req.user.userObj");
//             next();
//         } catch (jwtError) {
//             console.error("Error verifying token:", jwtError);
//             res.status(401).json({ message: "Invalid token" });
//         }
//     }
// };

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

// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
// });
export const authenticateFirebase = async (req, res, next) => {
    const { authorization } = req.headers;

    if (!authorization || !authorization.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authorization.split("Bearer ")[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.uid = decodedToken.uid;
        req.email = decodedToken.email;
        next();
    } catch (error) {
        console.error("Error verifying Firebase ID token:", error);
        return res.status(401).json({ error: "Unauthorized" });
    }
};
