import jwt from "jsonwebtoken";
import { CONFIG } from "./Config";

export const generateAccessJwt = async (obj) => {
    return jwt.sign(
        {
            ...obj,
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
        },
        CONFIG.JWT_ACCESS_TOKEN_SECRET
    );
};

export const generateRefreshJwt = (obj) => {
    return jwt.sign(
        {
            ...obj,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
        },
        CONFIG.JWT_REFERSH_TOKEN_SECRET
    );
};
