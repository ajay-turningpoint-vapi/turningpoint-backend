import jwt from "jsonwebtoken";
import { CONFIG } from "./Config";

export const generateAccessJwt = async (obj) => {
    return jwt.sign(
        {
            ...obj,
            exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 1 month (30 days)
        },
        CONFIG.JWT_ACCESS_TOKEN_SECRET
    );
};

export const generateRefreshJwt = (obj) => {
    return jwt.sign(
        {
            ...obj,
            exp: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 3 months (90 days)
        },
        CONFIG.JWT_REFERSH_TOKEN_SECRET
    );
};
