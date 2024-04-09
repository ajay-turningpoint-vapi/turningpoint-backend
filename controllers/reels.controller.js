import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import Reels from "../models/reels.model";
import ReelLikes from "../models/reelLikes.model";
import ActivityLog from "../models/activityLogs.model";

export const addReels = async (req, res, next) => {
    try {
        const uploadedFiles = req.files || [];

        // Assuming 'images' is the field name used in upload.array('images', 5)
        const fileUrls = uploadedFiles.map((file) => file.location);

        // Map file URLs to the corresponding elements in req.body
        req.body.forEach((el, index) => {
            if (fileUrls[index]) {
                el.fileUrl = fileUrls[index];
            }
        });
        console.log(req.body);
        await Reels.insertMany(req.body);

        res.status(200).json({ message: "Reel Successfully Created", success: true });
    } catch (err) {
        next(err);
    }
};

export const addReels1 = async (req, res, next) => {
    try {
        for (const el of req.body) {
            console.log(el);
            if (el.base64) {
                el.fileUrl = await storeFileAndReturnNameBase64(el.base64);
            }
        }
        await Reels.insertMany(req.body);

        res.status(200).json({ message: "Reel Successfully Created", success: true });
    } catch (err) {
        next(err);
    }
};

export const getReels = async (req, res, next) => {
    try {
        let reelsArr = await Reels.find().sort({ createdAt: -1 }).exec();
        if (!(reelsArr.length > 0)) {
            throw new Error("No reels created yet");
        }
        res.status(200).json({ message: "Reels Found", data: reelsArr, success: true });
    } catch (err) {
        next(err);
    }
};

export const getReelsPaginated2 = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        let totalCount = await Reels.countDocuments();
        if (totalCount === 0) {
            return res.status(404).json({ message: "No reels found", success: false });
        }

        // Retrieve a random set of reels
        let reelsArr = await Reels.aggregate([{ $sample: { size: totalCount } }]); // Adjust the size as needed
        console.log("reels", reelsArr);
        // Fetch liked status for each reel and create a new array with modified structure
        const reelsWithLikedStatus = await Promise.all(
            reelsArr.map(async (reel) => {
                const likedStatus = await ReelLikes.findOne({
                    userId: req.user.userId,
                    reelId: reel._id,
                });

                return {
                    ...reel,
                    likedByCurrentUser: likedStatus !== null, // Will be true or false
                };
            })
        );

        // Log the activity
        await ActivityLog.create({
            userId: req.user.userId,
            type: "Watching Reels",
        });

        res.status(200).json({ message: "Reels Found", data: reelsWithLikedStatus, success: true });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

export const getReelsPaginated = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Pagination parameters
        let page = parseInt(req.query.page) || 1;
        let pageSize = parseInt(req.query.pageSize) || 10;

        // Count total reels
        let totalCount = await Reels.countDocuments();
        if (totalCount === 0) {
            return res.status(404).json({ message: "No reels found", success: false });
        }

        // Calculate total pages
        let totalPages = Math.ceil(totalCount / pageSize);

        // Retrieve reels for the current page with random ordering
        let reelsArr = await Reels.aggregate([
            { $sample: { size: pageSize } }, // Randomly select documents
            { $sort: { _id: 1 } }, // Sort by _id to maintain consistency for pagination
        ])
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .exec();

        // Fetch liked status for each reel and create a new array with modified structure
        const reelsWithLikedStatus = await Promise.all(
            reelsArr.map(async (reel) => {
                const likedStatus = await ReelLikes.findOne({
                    userId: req.user.userId,
                    reelId: reel._id,
                });

                return {
                    ...reel,
                    likedByCurrentUser: likedStatus !== null, // Will be true or false
                };
            })
        );

        // Log the activity
        await ActivityLog.create({
            userId: req.user.userId,
            type: "Watching Reels",
        });

        res.status(200).json({ message: "Reels Found", data: reelsWithLikedStatus, totalPages: totalPages, success: true });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

export const getReelsPaginated1 = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Pagination parameters
        let page = parseInt(req.query.page) || 1;
        let pageSize = parseInt(req.query.pageSize) || 10;

        // Count total reels
        let totalCount = await Reels.countDocuments();
        if (totalCount === 0) {
            return res.status(404).json({ message: "No reels found", success: false });
        }

        // Calculate total pages
        let totalPages = Math.ceil(totalCount / pageSize);

        // Generate a random offset for pagination
        let randomOffset = Math.floor(Math.random() * (totalCount - pageSize));

        // Retrieve reels for the current page with random offset
        let reelsArr = await Reels.find().skip(randomOffset).limit(pageSize).lean().exec();

        // Fetch liked status for each reel and create a new array with modified structure
        const reelsWithLikedStatus = await Promise.all(
            reelsArr.map(async (reel) => {
                const likedStatus = await ReelLikes.findOne({
                    userId: req.user.userId,
                    reelId: reel._id,
                });

                return {
                    ...reel,
                    likedByCurrentUser: likedStatus !== null, // Will be true or false
                };
            })
        );

        // Log the activity
        await ActivityLog.create({
            userId: req.user.userId,
            type: "Watching Reels",
        });

        res.status(200).json({ message: "Reels Found", data: reelsWithLikedStatus, totalPages: totalPages, success: true });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

export const updateById = async (req, res, next) => {
    try {
        let reelsObj = await Reels.findById(req.params.id).exec();
        if (!reelsObj) {
            throw new Error("Could not find reel");
        }
        if (req.body.fileUrl && `${req.body.fileUrl}`.includes("base64")) {
            req.body.fileUrl = await storeFileAndReturnNameBase64(req.body.fileUrl);
        } else {
            delete req.body.fileUrl;
        }
        await Reels.findByIdAndUpdate(req.params.id, req.body).exec();

        res.status(200).json({ message: "Reel Updated Successfully", success: true });
    } catch (err) {
        next(err);
    }
};

export const deleteById = async (req, res, next) => {
    try {
        let reelsObj = await Reels.findById(req.params.id).exec();
        if (!reelsObj) {
            throw new Error("Could not find reel");
        }
        await Reels.findByIdAndDelete(req.params.id).exec();
        res.status(200).json({ message: "Reel Deleted Successfully", success: true });
    } catch (err) {
        next(err);
    }
};

export const deleteMultipleReels = async (req, res, next) => {
    try {
        console.log(req.body, "req.body");
        await Reels.deleteMany({ _id: { $in: [...req.body.reelArr.map((el) => el._id)] } }).exec();
        res.status(200).json({ message: "Reel Deleted Successfully", success: true });
    } catch (err) {
        next(err);
    }
};
