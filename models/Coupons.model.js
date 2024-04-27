import mongoose from "mongoose";
import { coupontype } from "../helpers/Constants";

let Coupons = mongoose.Schema(
    {
        name: String,
        value: Number,
        productId: String,
        productName: String,
        maximumNoOfUsersAllowed: { type: Number },
        location: {
            type: {
                type: String,
                enum: ["Point"], // Ensures the type is a Point
                required: true,
            },
            coordinates: {
                type: [Number], // Array of numbers [longitude, latitude]
                required: true,
            },
        },
        scanLocation: String,
    },

    { timestamps: true }
);
Coupons.index({ location: "2dsphere" });
export default mongoose.model("Coupons", Coupons);
