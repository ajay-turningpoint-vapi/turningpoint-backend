import admin from "../helpers/firebase";
import userModel from "../models/user.model";
export const sendSingleNotificationMiddleware = async (req, res, next) => {
    try {
        const userId = req.params.id || req.user.userId; // Adjust this based on your authentication setup
        const { title, body } = req.body;
        if (!title || !body) {
            return res.status(400).json({ error: "Title and body are required in the request" });
        }
        const fcmTokenData = await userModel.findOne({ _id: userId });
        if (fcmTokenData) {
            const message = {
                token: fcmTokenData.fcmToken,
                notification: {
                    title,
                    body,
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

export const sendNotificationMiddleware = async (req, res, next) => {
    try {
        // Get user IDs from the previous middleware or wherever you have stored them
        const userIds = req.allUserIds;
        const { title, body } = req.body;
        if (!title || !body) {
            return res.status(400).json({ error: "Title and body are required in the request" });
        }
        const fcmTokensData = await userModel.find({ _id: { $in: userIds }, role: { $ne: "ADMIN" } });
        if (fcmTokensData.length > 0) {
            // Create an array of FCM tokens
            const tokens = fcmTokensData.map((tokenData) => tokenData.token);

            const message = {
                tokens: tokens, // Specify the array of FCM tokens here
                notification: {
                    title,
                    body,
                },
            };

            // Send the notification to multiple tokens
            const response = await admin.messaging().sendMulticast(message);
            console.log("Successfully sent notification to multiple users:", response);

            // You can handle the response or modify the behavior as needed

            next();
        } else {
            // Handle the case where no FCM tokens are found for the users
            res.status(400).json({ error: "FCM tokens not found for the users" });
        }
    } catch (error) {
        console.error("Error sending notification:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const sendNotification = async (fcmToken, message) => {
    console.log(fcmToken, message);
    try {
        const payload = {
            notification: {
                title: "Geofence Alert",
                body: message,
            },
        };
        const response = await admin.messaging().send({
            token: fcmToken,
            notification: payload.notification, // Use notification field directly
        });
        console.log("Notification sent successfully:", response);
        return response;
    } catch (error) {
        console.error("Error sending notification:", error);
        throw new Error("Error sending notification");
    }
};


