import { pointTransactionType } from "../helpers/Constants";
import ReelLikes from "../models/reelLikes.model";
import Reel from "../models/reels.model";
import User from "../models/user.model";
import { createPointlogs } from "./pointHistory.controller";


export const likeReels = async (req, res, next) => {
    try {
        console.log(req.body)
        let reelLikesObj = await ReelLikes.findOne({ userId: req.body.userId, reelId: req.body.reelId }).exec();
        if (reelLikesObj) {
            let reelObj = await Reel.findById(req.body.reelId).exec()
            if (reelObj) {
                let pointDescription = 'Deducted ' + reelObj?.points + ' points for unliking a reel';
                await createPointlogs(req.body.userId, reelObj?.points, pointTransactionType.DEBIT, pointDescription, 'success');
                let userObj = User.findByIdAndUpdate(req.body.userId, { $inc: { points: -1 * parseInt(reelObj?.points) } }).exec()
                await ReelLikes({ userId: req.body.userId, reelId: req.body.reelId }).save()
            }
            await ReelLikes.findByIdAndDelete(reelLikesObj._id).exec()
            res.status(200).json({ message: "UnLiked Reel Successfully", success: true });
        }
        else {
            let reelObj = await Reel.findById(req.body.reelId).exec()
            if (reelObj) {
                let pointDescription = 'Earned ' + reelObj?.points + ' points for liking a reel';
                await createPointlogs(req.body.userId, reelObj?.points, pointTransactionType.CREDIT, pointDescription, 'success');
                let userObj = User.findByIdAndUpdate(req.body.userId, { $inc: { points: reelObj?.points } }).exec()
                await ReelLikes({ userId: req.body.userId, reelId: req.body.reelId }).save()
            }
            res.status(200).json({ message: "Liked Reel Successfully", success: true });
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





