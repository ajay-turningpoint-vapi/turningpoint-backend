import jwt from "jsonwebtoken";
import { CONFIG } from "./Config";




export const generateAccessJwt = async (obj) => {
    return jwt.sign(
        {
            ...obj,
            exp: Math.floor(Date.now() / 1000) + 10000 * 24 * 60 * 60, // valid for 10000 days
        },
        CONFIG.JWT_ACCESS_TOKEN_SECRET
    );
};

export const generateRefreshJwt = async (obj) => {
    return jwt.sign(
        {
            ...obj,
            exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        },
        CONFIG.JWT_ACCESS_TOKEN_SECRET
    );
};
