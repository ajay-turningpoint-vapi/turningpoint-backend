import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import Reels from "../models/reels.model";
import ReelLikes from "../models/reelLikes.model";
import ActivityLog from "../models/activityLogs.model";
import mongoose from "mongoose";
export const addReels = async (req, res, next) => {
    try {
        // if (!req.body.fileUrl) throw new Error("fileUrl is mandatory");
        // if (!isValid(req.body.fileUrl)) throw new Error('fileUrl cant be empty');
        for (const el of req.body) {
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

export const getReelsPaginated = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        let totalCount = await Reels.countDocuments();

        if (totalCount === 0) {
            return res.status(404).json({ message: "No reels found", success: false });
        }

        // Retrieve a random set of reels
        let reelsArr = await Reels.aggregate([{ $sample: { size: 10 } }]); // Adjust the size as needed

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

// export const getReelsPaginated = async (req, res, next) => {
//     try {
//         if (!req.user) {
//             return res.status(401).json({ message: "Unauthorized" });
//         }

//         let totalCount = await Reels.countDocuments();

//         if (totalCount === 0) {
//             return res.status(404).json({ message: "No reels found", success: false });
//         }

//         let reelsArr = await Reels.aggregate([
//             {
//                 $sample: {
//                     size: totalCount,
//                 },
//             },
//         ]);
//         if (!reelsArr || reelsArr.length === 0) {
//             return res.status(500).json({ message: "Error retrieving reels", success: false });
//         }
//         await ActivityLog.create({
//             userId: req.user.userId,
//             type: "Watching Reels",
//         });
//         res.status(200).json({ message: "Reels Found", data: reelsArr, success: true });
//     } catch (err) {
//         console.error(err);
//         next(err);
//     }
// };

// export const getReelsPaginated = async (req, res, next) => {
//     try {
//         let totalCount = await Reels.countDocuments();
//         let page = 0;
//         page = Math.floor(Math.random() * (totalCount - 0 + 1) + 0);

//         if (!req.query || !req.query.limit || !req.query.page) {
//             throw new Error("invalid route");
//         }
//         console.log(req.query.limit);
//         let reelsArr = await Reels.aggregate([
//             {
//                 $sample: {
//                     size: parseInt(req.query.limit),
//                 },
//             },
//         ]);
//         console.log(reelsArr, reelsArr.length, "reelsArr.length", "reels arr");
//         res.status(200).json({ message: "Reels Found", data: reelsArr, success: true });
//     } catch (err) {
//         next(err);
//     }
// };

// export const getReelsPaginated = async (req, res, next) => {
//     try {
//         if (!req.user) {
//             return res.status(401).json({ message: "Unauthorized" });
//         }

//         await ActivityLog.create({
//             userId: req.user.userId,
//             type: "Watching Reels",
//         });

//         const likedReelIds = await ReelLikes.find({ userId: req.user.userId }).distinct("reelId");

//         Reels.find({ _id: { $nin: likedReelIds } }, (err, results) => {
//             if (err) {
//                 return res.status(500).json({ message: "Error finding reels", success: false });
//             } else {
//                 if (results.length === 0) {
//                     return res.status(404).json({ message: "No matching reels found", success: false });
//                 }

//                 // Shuffle the results array randomly using Fisher-Yates algorithm
//                 for (let i = results.length - 1; i > 0; i--) {
//                     const j = Math.floor(Math.random() * (i + 1));
//                     [results[i], results[j]] = [results[j], results[i]];
//                 }

//                 res.status(200).json({ message: "Reels Found", data: results, success: true });
//             }
//         });
//     } catch (err) {
//         next(err);
//     }
// };

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
