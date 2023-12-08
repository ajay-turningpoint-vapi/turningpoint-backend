import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import Reels from "../models/reels.model";

import { isValid } from "../helpers/Validators";
import { create } from "archiver";

export const addReels = async (req, res, next) => {
    try {

        // if (!req.body.name) throw new Error("name is mandatory");
        // if (!isValid(req.body.name)) throw new Error('name cant be empty');
        // if (!req.body.description) throw new Error("description is mandatory");
        // if (!isValid(req.body.description)) throw new Error('description cant be empty');
        // if (!req.body.fileUrl) throw new Error("fileUrl is mandatory");
        // if (!isValid(req.body.fileUrl)) throw new Error('fileUrl cant be empty');
        for (const el of req.body) {
            if (el.base64) {
                el.fileUrl = await storeFileAndReturnNameBase64(el.base64);
            }
        }
        await Reels.insertMany(req.body)


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
        res.status(200).json({ message: 'Reels Found', data: reelsArr, success: true });

    } catch (err) {
        next(err);
    }
};



export const getReelsPaginated = async (req, res, next) => {
    try {

        let totalCount = await Reels.countDocuments();
        let page = 0;
        page = Math.floor(Math.random() * (totalCount - 0 + 1) + 0)



        if (!req.query || !req.query.limit || !req.query.page) {
            throw new Error("invalid route");
        }
        console.log(req.query.limit)
        console.log(req.query.limit)
        let reelsArr = await Reels.aggregate([{
            '$sample': {
                'size': parseInt(req.query.limit)
            }
        }])
        // if (!(reelsArr.length > 0)) {

        //     throw new Error("No reels created yet");
        // }
        console.log(reelsArr, reelsArr.length, "reelsArr.length", "reels arr")
        res.status(200).json({ message: 'Reels Found', data: reelsArr, success: true });

    } catch (err) {
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
        }
        else {
            delete req.body.fileUrl
        }
        await Reels.findByIdAndUpdate(req.params.id, req.body).exec();


        res.status(200).json({ message: 'Reel Updated Successfully', success: true });
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
        res.status(200).json({ message: 'Reel Deleted Successfully', success: true });
    } catch (err) {
        next(err);
    }
};

export const deleteMultipleReels = async (req, res, next) => {
    try {
        console.log(req.body, "req.body")
        await Reels.deleteMany({ _id: { $in: [...req.body.reelArr.map(el => el._id)] } }).exec();
        res.status(200).json({ message: 'Reel Deleted Successfully', success: true });
    } catch (err) {
        next(err);
    }
};
