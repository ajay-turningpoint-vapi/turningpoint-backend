// Adjust the path to your User model

const { default: userModel } = require("../models/user.model");

const getAllUserIdsMiddleware = async (req, res, next) => {
    try {
        const allUserIds = await userModel.find({}, "_id");
        req.allUserIds = allUserIds.map((user) => user._id);
        next();
    } catch (error) {
        console.error("Error getting all user IDs:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = getAllUserIdsMiddleware;
