import mongoose from "mongoose";
import { coupontype } from "../helpers/Constants";

let Coupons = mongoose.Schema(
    {
        name: String,
        // description: String,
        value: Number,
        productId: String,
        productName: String,
        // validTill: { type: Date },
        maximumNoOfUsersAllowed: { type: Number },
    },
    { timestamps: true }
);

export default mongoose.model("Coupons", Coupons);
