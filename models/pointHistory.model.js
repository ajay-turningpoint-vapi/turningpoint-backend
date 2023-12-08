import mongoose from "mongoose";

let pointHistory = mongoose.Schema({
    transactionId: String,
    userId: { type: mongoose.Types.ObjectId },
    amount: Number,
    description: String,
    type: { type: String, enum: ["CREDIT", "DEBIT"] },
    status: { type: String, enum: ["success", "failed", "pending"] },
    reason: String,
    additionalInfo: {
        transferType: { type: String, enum: ["UPI", "Bank", "CASH"] },
        transferDeatils: Object,
    }
},
    { timestamps: true });


export default mongoose.model("pointHistory", pointHistory);