import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import Contest from "../models/contest.model";
import Prize from "../models/prize.model";
import userContest from "../models/userContest";
import userModel from "../models/user.model";
import { createPointlogs } from "./pointHistory.controller";
import { pointTransactionType } from "./../helpers/Constants";

let Contestintial = "TNPC";

export const addContest = async (req, res, next) => {
    try {
        if (req.body.image) {
            req.body.image = await storeFileAndReturnNameBase64(req.body.image);
        }
        let foundUrl = await Contest.findOne({ name: req.body.name }).exec();
        if (foundUrl) throw { status: 400, message: "Contest  already registered" };
        req.body.contestId = Contestintial + Math.floor(Date.now() / 1000) + (Math.random() + 1).toString(36).substring(7);
        let ContestObj = await Contest(req.body).save();
        console.log(ContestObj);

        if (req.body?.prizeArr && req.body?.prizeArr?.length > 0) {
            let rank = 1;
            console.log("przei loop fdgfdgf");
            for (const prize of req.body?.prizeArr) {
                let prizeObj = {
                    rank: parseInt(rank),
                    contestId: ContestObj._id,
                    name: prize.name,
                    description: prize.description,
                };

                console.log(prizeObj, "przei obj ");

                if (prize.image) {
                    prizeObj.image = await storeFileAndReturnNameBase64(prize.image);
                }
                let prizsObje = await Prize(prizeObj).save();
                rank++;
            }
        }
        // console.log(req.body);

        res.status(201).json({ message: "Contest Registered", success: true });
    } catch (err) {
        next(err);
    }
};

export const getContestById = async (req, res, next) => {
    try {
        const Contestobj = await Contest.findById(req.params.id).lean().exec();
        if (Contestobj) {
            let prizeContestArry = await Prize.find({ contestId: `${Contestobj._id}` }).exec();
            Contestobj.prizeArr = prizeContestArry;
        }

        res.status(200).json({ message: "found Contest", data: Contestobj, success: true });
    } catch (err) {
        next(err);
    }
};

export const getContest = async (req, res, next) => {
    try {
        console.log(req.query, "query");

        let pipeline = [
            {
                $addFields: {
                    combinedStartDateTime: {
                        $dateFromString: {
                            dateString: {
                                $concat: [
                                    {
                                        $dateToString: {
                                            date: "$startDate",
                                            format: "%Y-%m-%d",
                                        },
                                    },
                                    "T",
                                    "$startTime",
                                    ":00",
                                ],
                            },
                            timezone: "Asia/Kolkata",
                        },
                    },
                    combinedEndDateTime: {
                        $dateFromString: {
                            dateString: {
                                $concat: [
                                    {
                                        $dateToString: {
                                            date: "$endDate",
                                            format: "%Y-%m-%d",
                                        },
                                    },
                                    "T",
                                    "$endTime",
                                    ":00",
                                ],
                            },
                            timezone: "Asia/Kolkata",
                        },
                    },
                },
            },
            {
                $addFields: {
                    status: {
                        $cond: {
                            if: {
                                $and: [
                                    {
                                        $gt: ["$combinedEndDateTime", new Date()],
                                    },
                                    {
                                        $lt: ["$combinedStartDateTime", new Date()],
                                    },
                                ],
                            },
                            then: "ACTIVE",
                            else: "INACTIVE",
                        },
                    },
                },
            },

            {
                $match: {
                    $and: [
                        req.query.admin
                            ? {}
                            : {
                                  combinedEndDateTime: {
                                      $gt: new Date(),
                                  },
                              },
                        {
                            combinedStartDateTime: {
                                $lt: new Date(),
                            },
                        },
                    ],
                },
            },
        ];

        let getContest = await Contest.aggregate(pipeline);

        for (let Contestobj of getContest) {
            if (Contestobj?._id) {
                let prizeContestArry = await Prize.find({ contestId: `${Contestobj._id}` }).exec();
                Contestobj.prizeArr = prizeContestArry;
            }
        }
        res.status(200).json({ message: "getContest", data: getContest, success: true });
    } catch (err) {
        next(err);
    }
};

export const updateById = async (req, res, next) => {
    try {
        console.log("updaeredsfasdfsadf");
        if (req.body.image && req.body.image.startsWith("data:")) {
            req.body.image = await storeFileAndReturnNameBase64(req.body.image);
        }
        const ContestObj = await Contest.findByIdAndUpdate(req.params.id, req.body, { new: true }).exec();
        if (!ContestObj) throw { status: 400, message: "Contest Not Found" };
        console.log(ContestObj);
        if (req.body?.prizeArr && req.body?.prizeArr?.length > 0) {
            let rank = 1;
            console.log("przei loop fdgfdgf");
            for (const prize of req.body?.prizeArr) {
                let prizeObj = {
                    rank: parseInt(rank),
                    contestId: ContestObj._id,
                    name: prize.name,
                    description: prize.description,
                };

                console.log(prizeObj, "przei obj ");

                if (prize.image && prize.image.startsWith("data:")) {
                    prizeObj.image = await storeFileAndReturnNameBase64(prize.image);
                }
                if (prize._id == "") {
                    let prizsObje = await Prize(prizeObj).save();
                } else {
                    let prizsObje = await Prize.findByIdAndUpdate(prize._id, prizeObj, { new: true }).exec();
                }

                rank++;
            }
        }

        res.status(200).json({ message: "Contest Updated", success: true });
    } catch (err) {
        next(err);
    }
};

export const deleteById = async (req, res, next) => {
    try {
        let prizsObje = await Prize.deleteMany({ contestId: req.params.id }).exec();
        const ContestObj = await Contest.findByIdAndDelete(req.params.id).exec();
        if (!ContestObj) throw { status: 400, message: "Contest Not Found" };
        res.status(200).json({ message: "Contest Deleted", success: true });
    } catch (err) {
        next(err);
    }
};

export const joinContest = async (req, res, next) => {
    try {
        let ContestObj = await Contest.findById(req.params.id).exec();
        if (!ContestObj) throw { status: 400, message: "Contest Not Found" };

        let UserObj = await userModel.findById(req.user.userId).lean().exec();
        if (!UserObj) throw { status: 400, message: "User Not Found" };
        let points = ContestObj.points;
        if (UserObj.points <= 0 || UserObj.points < points) {
            throw { status: 400, message: "Insufficient balance" };
        }

        let userJoin = ContestObj.userJoin;

        console.log(ContestObj);
        let userContestObj = {
            contestId: ContestObj._id,
            userId: UserObj._id,
        };
        let userContestRes = await userContest(userContestObj).save();

        if (userContestRes) {
            let pointDescription = ContestObj.name + " Contest Joined with " + points + " Points";
            await createPointlogs(req.user.userId, points, pointTransactionType.DEBIT, pointDescription, "success");
            let userPoints = {
                points: UserObj.points - parseInt(points),
            };
            if (userPoints?.points >= 0) {
                console.log(userPoints);
                await userModel.findByIdAndUpdate(req.user.userId, userPoints).exec();
                await Contest.findByIdAndUpdate(req.params.id, { userJoin: parseInt(userJoin) + 1 }).exec();
            } else {
                throw { status: 400, message: "Insufficient balance" };
            }
        }
        res.status(200).json({ message: "Contest Joined Sucessfully", success: true });
    } catch (err) {
        next(err);
    }
};

export const myContests = async (req, res, next) => {
    try {
        let getContest = await userContest.find({ userId: req.user.userId }).lean().exec();
        for (let Contestobj of getContest) {
            if (Contestobj?.contestId) {
                let contest = await Contest.findById(Contestobj?.contestId).exec();
                Contestobj.constest = contest;
            }
        }
        console.log(getContest, "pp");

        res.status(200).json({ message: "getContest", data: getContest, success: true });
    } catch (err) {
        next(err);
    }
};

export const luckyDraw = async (req, res, next) => {
    try {
        let dateToBeComparedStart = new Date(req.body.date);
        dateToBeComparedStart.setHours(0, 0, 0);
        let dateToBeComparedEnd = new Date(req.body.date);
        dateToBeComparedEnd.setHours(23, 59, 59);

        let allContests = await Contest.find({ endTime: req.body.time, endDate: { $gte: dateToBeComparedStart.getTime(), $lte: dateToBeComparedEnd.getTime() } }).exec();
        for (const el of allContests) {
            try {
                let contestPrizes = await Prize.find({ contestId: el._id }).sort({ rank: 1 }).lean().exec();
                let contestUsers = await userContest.find({ contestId: el._id }).lean().exec();
                if (contestPrizes.length > 0 && contestUsers.length > 0) {
                    for (let prize of contestPrizes) {
                        if (!contestUsers.length) {
                            break;
                        }
                        var randomItem = contestUsers[Math.floor(Math.random() * contestUsers.length)];
                        await userContest.findByIdAndUpdate(randomItem._id, { status: "win", rank: prize?.rank }).exec();
                        contestUsers = contestUsers.filter((el) => `${el._id}` != `${randomItem._id}`);
                    }
                }
                await userContest.updateMany({ contestId: el._id, status: "join" }, { status: "lose" }).exec();
                await Contest.findByIdAndUpdate(el._id, { status: "CLOSED" }).exec();
            } catch (err) {
                console.error(err);
            }
        }
        res.status(200).json({ message: "getContest", success: true });
    } catch (err) {
        next(err);
    }
};

export const previousContest = async (req, res, next) => {
    try {
        let currentDate = new Date();
        //for perivous Month First date
        currentDate.setDate(0);
        currentDate.setDate(1);
        let previousFirstDate = currentDate;
        //for previous month last date
        currentDate = new Date();
        currentDate.setDate(0);
        let previousLastDate = currentDate;
        let ContestObj = await Contest.findOne({ status: "CLOSED", endDate: { $gte: previousFirstDate, $lte: previousLastDate } })
            .sort({ endDate: -1 })
            .lean()
            .exec();
        if (ContestObj) {
            let contestUsers = await userContest.find({ contestId: ContestObj._id, status: "win" }).lean().exec();
            let contestPrizes = await Prize.find({ contestId: ContestObj._id }).sort({ rank: 1 }).lean().exec();

            console.log(contestUsers, "contestUsers");

            for (const user of contestPrizes) {
                let contestPrizes = await userContest.findOne({ contestId: user.contestId, rank: user.rank, status: "win" }).lean().exec();
                if (contestPrizes) {
                    let userObj = await userModel.findById(contestPrizes.userId).exec();
                    user.userObj = userObj;
                }
            }
            ContestObj.contestPrizes = contestPrizes;
        }

        res.status(200).json({ message: "getContest", data: ContestObj, success: true });
    } catch (err) {
        next(err);
    }
};

export const currentContest = async (req, res, next) => {
    try {
        let currentDate = new Date();
        //for perivous Month First date
        currentDate.setDate(1);
        currentDate.setHours(0, 0, 0, 0);
        let previousFirstDate = currentDate;
        console.log(previousFirstDate, "previousFirstDate");
        //for previous month last date
        currentDate = new Date();
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(0);

        let previousLastDate = currentDate;
        let ContestObj = await Contest.findOne({ status: "CLOSED", endDate: { $gte: previousFirstDate, $lte: previousLastDate } })
            .sort({ endDate: -1 })
            .lean()
            .exec();
        if (ContestObj) {
            let contestUsers = await userContest.find({ contestId: ContestObj._id, status: "win" }).lean().exec();
            let contestPrizes = await Prize.find({ contestId: ContestObj._id }).sort({ rank: 1 }).lean().exec();
            for (const user of contestPrizes) {
                let contestPrizes = await userContest.findOne({ contestId: user.contestId, rank: user.rank, status: "win" }).lean().exec();
                if (contestPrizes) {
                    let userObj = await userModel.findById(contestPrizes.userId).exec();
                    user.userObj = userObj;
                }
            }
            ContestObj.contestPrizes = contestPrizes;
        }
        res.status(200).json({ message: "getContest", data: ContestObj, success: true });
    } catch (err) {
        next(err);
    }
};
