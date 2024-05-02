import { customAlphabet } from "nanoid";
import User from "../models/user.model";

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

export const generateUid = async () => {
    let check = true;
    while (check) {
        let tempUid = nanoid();
        let userObj = await User.findOne({ uid: tempUid }).exec();
        if (!userObj) {
            check = false;
            return tempUid;
        }
        console.log("GENERATING NEW UID,Current", tempUid);
    }
};

export const randomNumberGenerator = () => {
    const values = [100, 200, 300, 400, 500];
    const randomIndex = Math.floor(Math.random() * values.length);
    return values[randomIndex];
};
