import mongoose from "mongoose";

import { rolesObj } from "../helpers/Constants";
import { customAlphabet } from "nanoid";
import axios from "axios";
const nanoid = customAlphabet("1234567890", 10);
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
            phone: String,
        },
        addressLine: String,
        country: String,
        stateName: String,
        pincode: String,
        // address: String,
        password: { type: String },
        city: { type: String },
        points: { type: Number, default: 100 },
        isActive: { type: Boolean, default: false },
        role: {
            type: String,
            default: rolesObj.CARPENTER,
        },
        panNo: { type: String },
        aadharNo: { type: Number },
        image: String,
        idFrontImage: String,
        idBackImage: String,
        contests: [
            {
                contestName: {
                    type: String,
                    required: true,
                },
                userJoinContest: {
                    type: Number,
                    default: 0,
                },
            },
        ],
        bankDetails: [
            {
                banktype: String,
                accountName: String,
                accountNo: String,
                ifsc: String,
                bank: String,
                isActive: { type: Boolean, default: false },
            },
        ],
        upiId: String,
        kycStatus: {
            type: String,
            default: "pending",
        },
        isOnline: { type: Boolean, default: false },
        selfie:  String ,
        visitingCard: { type: String },
        shopImageArr: [{ shopImage: { type: String } }],
        fcmToken: { type: String, required: true },
        refCode: { type: String, unique: true },
        address: {
            type: {
                type: String,
                default: "Point",
            },
            coordinates: [Number],
        },
        actualAddress: { type: String },
        location: {
            type: {
                type: String,
                enum: ["Point"],
            },
            coordinates: {
                type: [Number],
            },
        },
        version: {
            type: Number,
            default: 0,
        },
    },

    { timestamps: true }
);
User.index({ location: "2dsphere" });
User.pre("save", function (next) {
    this.refCode = "TP" + nanoid();
    next();
});

User.pre("save", async function (next) {
    try {
        if (this.isModified("address.coordinates")) {
            const { coordinates } = this.address; // Access coordinates from the address field
            const [longitude, latitude] = coordinates; // Destructure coordinates array
            const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=AIzaSyB_mx6YLhBCVyk1luPlHDC-z1BKwxkPf3o`);
            console.log("test", response);
            const { results } = response.data;
            if (results && results.length > 0) {
                this.actualAddress = results[0].formatted_address;
            }
        }
        next();
    } catch (error) {
        next(error);
    }
});

export default mongoose.model("User", User);
