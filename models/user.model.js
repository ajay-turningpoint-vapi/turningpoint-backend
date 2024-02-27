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
            name: String,
            businessName: String,
        },
        addressLine: String,
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
        idFrontImage: String,
        idBackImage: String,
        bankDetails: [
            {
                banktype: String,
                accountName: String,
                accountNo: String,
                ifsc: String,
                bank: String,
                isActive: { type: Boolean, default: true },
               
            },
        ],
        upiId: String,
        kycStatus: {
            type: Boolean,
            default: null,
        },
        visitingCard: { type: String },
        shopImageArr: [{ shopImage: { type: String } }],
    },

    { timestamps: true }
);

export default mongoose.model("User", User);
