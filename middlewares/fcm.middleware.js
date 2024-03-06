import admin from "../helpers/firebase";
import userModel from "../models/user.model";
export const sendNotificationMiddleware = async (req, res, next) => {
    try {
        const userId = req.user.userId; // Adjust this based on your authentication setup
        const fcmTokenData = await userModel.findOne({ _id: userId });
        if (fcmTokenData) {
            const message = {
                token: fcmTokenData.fcmToken,
                notification: {
                    title: "Turning Point",
                    body: "User updated",
                },
            };

            const response = await admin.messaging().send(message);
            console.log("Successfully sent notification:", response);

            // You can handle the response or modify the behavior as needed

            next();
        } else {
            // Handle the case where FCM token is not found
            res.status(400).json({ error: "FCM token not found for the user" });
        }
    } catch (error) {
        console.error("Error sending notification:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
