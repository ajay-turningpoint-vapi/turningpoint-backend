import mongoose from "mongoose";
import ActivityLog from "../models/activityLogs.model";
import User from "../models/user.model";
export const getUserActivities = async (req, res, next) => {
    try {
        const allActivityLogs = await ActivityLog.find().populate("userId");

        // Map activity logs and format timestamps
        const formattedLogs = allActivityLogs.map((log) => {
            return {
                logId:log._id,
                userId:log.userId._id,
                name: log.userId.name, // Include other user properties as needed
                type: log.type,
                timestamp: log.timestamp.toLocaleString(), // Convert timestamp to human-readable format
            };
        });

        res.json({ ActivityLogs: formattedLogs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getUserActivitiesById = async (req, res, next) => {
    try {
        const userId = req.params.userId;

        // Validate the user ID format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }

        // Check if the user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Retrieve activity logs by user ID using the ActivityLog model
        const userActivityLogs = await ActivityLog.find({ userId });

        // Map activity logs and format timestamps
        const formattedLogs = userActivityLogs.map((log) => {
            return {
                logId:log._id,
                name: log.userId.name, // Include other user properties as needed
                type: log.type,
                timestamp: log.timestamp.toLocaleString(), // Convert timestamp to human-readable format
            };
        });

        res.json({ userActivityLogs: formattedLogs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
