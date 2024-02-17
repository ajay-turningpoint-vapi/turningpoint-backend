import { pointTransactionType } from "../helpers/Constants";
import ReelLikes from "../models/reelLikes.model";
import Reel from "../models/reels.model";
import User from "../models/user.model";
import { createPointlogs } from "./pointHistory.controller";


// export const likeReels = async (req, res, next) => {
//     try {
//         console.log(req.body)
//         let reelLikesObj = await ReelLikes.findOne({ userId: req.body.userId, reelId: req.body.reelId }).exec();
//         if (reelLikesObj) {
//             let reelObj = await Reel.findById(req.body.reelId).exec()
//             if (reelObj) {
//                 let pointDescription = 'Deducted ' + reelObj?.points + ' points for unliking a reel';
//                 await createPointlogs(req.body.userId, reelObj?.points, pointTransactionType.DEBIT, pointDescription, 'success');
//                 let userObj = User.findByIdAndUpdate(req.body.userId, { $inc: { points: -1 * parseInt(reelObj?.points) } }).exec()
//                 await ReelLikes({ userId: req.body.userId, reelId: req.body.reelId }).save()
//             }
//             await ReelLikes.findByIdAndDelete(reelLikesObj._id).exec()
//             res.status(200).json({ message: "UnLiked Reel Successfully", success: true });
//         }
//         else {
//             let reelObj = await Reel.findById(req.body.reelId).exec()
//             if (reelObj) {
//                 let pointDescription = 'Earned ' + reelObj?.points + ' points for liking a reel';
//                 await createPointlogs(req.body.userId, reelObj?.points, pointTransactionType.CREDIT, pointDescription, 'success');
//                 let userObj = User.findByIdAndUpdate(req.body.userId, { $inc: { points: reelObj?.points } }).exec()
//                 await ReelLikes({ userId: req.body.userId, reelId: req.body.reelId }).save()
//             }
//             res.status(200).json({ message: "Liked Reel Successfully", success: true });
//         }
//     } catch (err) {
//         next(err);
//     }
// };


export const likeReels = async (req, res, next) => {
    try {
        const { userId, reelId } = req.body;

        // Check if the user has already liked the reel
        const existingLike = await ReelLikes.findOne({ userId, reelId }).exec();

        if (!existingLike) {
            // User has not liked the reel, so like it
            const reelObj = await Reel.findById(reelId).exec();

            if (reelObj) {
                // Earn points for liking
                const pointsToEarn = parseInt(reelObj.points);
                await createPointlogs(userId, pointsToEarn, pointTransactionType.CREDIT, `Earned ${pointsToEarn} points for liking a reel`, 'success');

                // Increment user's points
                await User.findByIdAndUpdate(userId, { $inc: { points: pointsToEarn } }).exec();

                // Save the new like
                await ReelLikes.create({ userId, reelId });
            }

            res.status(200).json({ message: "Liked Reel Successfully", success: true });
        } else {
            // User has already liked the reel, respond accordingly
            res.status(200).json({ message: "Reel already liked", success: false });
        }
    } catch (err) {
        next(err);
    }
};


export const getLikeCount = async (req, res, next) => {
    try {

        console.log(req.body.userId, req.body.reelId)

        let reelLikedObj = await ReelLikes.findOne({ userId: req.body.userId, reelId: req.body.reelId }).exec()
        console.log(reelLikedObj, "reelLikedObj")
        let reelLikesCount = await ReelLikes.find({ reelId: req.body.reelId }).count().exec();
        res.status(200).json({ message: "Likes", data: { likeCount: reelLikesCount, liked: reelLikedObj ? true : false }, success: true });
    } catch (err) {
        next(err);
    }
};





