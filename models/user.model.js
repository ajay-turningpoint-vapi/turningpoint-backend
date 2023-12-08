import mongoose from "mongoose";
import { rolesObj } from "../helpers/Constants";

let User = mongoose.Schema(
    {
        email: { type: String },
        phone: { type: String },
        name: String,
        shopName: String,
        adressLine: String,
        country: String,
        stateName: String,
        pincode: String,
        address: String,
        password: { type: String },
        city: { type: String },
        points: { type: Number, default: 0.0 },
        isActive: { type: Boolean, default: false },
        role: {
            type: String,
            default: rolesObj.CARPENTER,
        },
        panNo: { type: String },
        aadharNo: { type: Number },
        image: String,
        idFrontImage: { type: String },
        idBackImage: { type: String },
        bankDetails: [{
            banktype: String,
            accountName: String,
            accountNo: Number,
            ifsc: String,
            bank: String,
            isActive: { type: Boolean, default: false },
        }],
        visitingCard: { type: String },
        shopImageArr: [{ shopImage: { type: String } }],
    },
    { timestamps: true }
);

export default mongoose.model("User", User);
