import mongoose from "mongoose";
import { rolesObj } from "../helpers/Constants";

let User = mongoose.Schema(
    {
        uid: { type: String, unique: true, required: true },
        email: { type: String, unique: true },
        phone: { type: String, required: true, unique: true },
        name: String,
        businessName: String,
        contractor: {
            contractorName: String,
            businessName: String,
        },
        adressLine: String,
        country: String,
        stateName: String,
        pincode: String,
        address: String,
        password: { type: String },
        city: { type: String },
        points: { type: Number, default: 100 },
        isActive: { type: Boolean, default: true },
        role: {
            type: String,
            default: rolesObj.CARPENTER,
        },
        panNo: { type: String },
        aadharNo: { type: Number },
        image: String,
        idFrontImage: { type: String },
        idBackImage: { type: String },
        bankDetails: [
            {
                banktype: String,
                accountName: String,
                accountNo: Number,
                ifsc: String,
                bank: String,
                isActive: { type: Boolean, default: true },
            },
        ],
        visitingCard: { type: String },
        shopImageArr: [{ shopImage: { type: String } }],
    },

    { timestamps: true }
);

export default mongoose.model("User", User);
