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
        // if (req.body.image) {
        //     req.body.image = await storeFileAndReturnNameBase64(req.body.image);
        // }
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
                    image: prize.image,
                };

                console.log(prizeObj, "przei obj ");

                // if (prize.image) {
                //     prizeObj.image = await storeFileAndReturnNameBase64(prize.image);
                // }
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

export const getCurrentContest = async (req, res, next) => {
    try {
        console.log(req.query, "query");

        let pipeline = [
            {
                $addFields: {
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
                                $gt: ["$combinedEndDateTime", new Date()],
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
                            combinedEndDateTime: {
                                $gt: new Date(),
                            },
                        },
                    ],
                },
            },
            {
                $sort: { combinedEndDateTime: 1 }, // Sort by end date and time in ascending order
            },
            {
                $limit: 1, // Limit to the first result (nearest end date and time)
            },
        ];

        let getCurrentContest = await Contest.aggregate(pipeline);

        if (getCurrentContest.length > 0) {
            // Fetch prize data for the current contest
            let prizeContestArray = await Prize.find({ contestId: `${getCurrentContest[0]._id}` }).exec();
            getCurrentContest[0].prizeArr = prizeContestArray;

            // Check if the user has joined the current contest
            if (req.user.userId) {
                let userJoinStatus = await userContest.exists({
                    contestId: getCurrentContest[0]._id,
                    userId: req.user.userId,
                    status: "join",
                });
                getCurrentContest[0].userJoinStatus = userJoinStatus != null;
            }
        }

        // Respond with the modified JSON object containing information about the current contest and associated prize array
        res.status(200).json({ message: "getCurrentContest", data: getCurrentContest, success: true });
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

        // Iterate over each contest to fetch additional data
        for (let Contestobj of getContest) {
            if (Contestobj?._id) {
                // Fetch prize data for each contest
                let prizeContestArry = await Prize.find({ contestId: `${Contestobj._id}` }).exec();
                Contestobj.prizeArr = prizeContestArry;

                // Check if the user has joined the contest
                if (req.user.userId) {
                    let userJoinStatus = await userContest.exists({
                        contestId: Contestobj._id,
                        userId: req.user.userId,
                        status: "join",
                    });
                    Contestobj.userJoinStatus = userJoinStatus != null;
                }
            }
        }

        // Respond with the modified JSON object containing information about the contests and associated prize arrays
        res.status(200).json({ message: "getContest", data: getContest, success: true });
    } catch (err) {
        next(err);
    }
};

export const getContestAdmin = async (req, res, next) => {
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
            console.log("prze loop fdgfdgf");
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

        // Check if the user has already joined the contest
        let existingJoin = await userContest.findOne({
            contestId: ContestObj._id,
            userId: UserObj._id,
            userJoinStatus: true,
        });

        if (existingJoin) {
            throw { status: 400, message: "User already joined the contest" };
        }

        let userJoin = ContestObj.userJoin;

        console.log(ContestObj);

        let userContestObj = {
            contestId: ContestObj._id,
            userId: UserObj._id,
            userJoinStatus: true, // Set userJoinStatus to true when joining
        };

        let userContestRes = await userContest(userContestObj).save();

        if (userContestRes) {
            let pointDescription = ContestObj.name + " Contest Joined with " + points + " Points";
            let mobileDescription = "Contest";
            await createPointlogs(req.user.userId, points, pointTransactionType.DEBIT, pointDescription, mobileDescription, "success");
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

        res.status(200).json({ message: "Contest Joined Successfully", success: true });
    } catch (err) {
        next(err);
    }
};

export const joinContestByCoupon = async (req, res, next) => {
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

        // Create entry for user's join
        let userContestObj = {
            contestId: ContestObj._id,
            userId: UserObj._id,
            userJoinStatus: true, // Set userJoinStatus to true when joining
        };

        // Save user's join entry
        await userContest.create(userContestObj);

        // Deduct points from user's balance
        let updatedUserPoints = UserObj.points - parseInt(points);
        await userModel.findByIdAndUpdate(req.user.userId, { points: updatedUserPoints });

        // Increment userJoin count in Contest document
        await Contest.findByIdAndUpdate(req.params.id, { $inc: { userJoin: 1 } });

        // Log point transaction
        let pointDescription = ContestObj.name + " Contest Joined with " + points + " Points";
        let mobileDescription = "Contest";
        await createPointlogs(req.user.userId, points, pointTransactionType.DEBIT, pointDescription, mobileDescription, "success");

        res.status(200).json({ message: "Contest Joined Successfully", success: true });
    } catch (err) {
        next(err);
    }
};

// export const joinContest = async (req, res, next) => {
//     try {
//         let ContestObj = await Contest.findById(req.params.id).exec();
//         if (!ContestObj) throw { status: 400, message: "Contest Not Found" };

//         let UserObj = await userModel.findById(req.user.userId).lean().exec();
//         if (!UserObj) throw { status: 400, message: "User Not Found" };
//         let points = ContestObj.points;
//         if (UserObj.points <= 0 || UserObj.points < points) {
//             throw { status: 400, message: "Insufficient balance" };
//         }
//         let userJoin = ContestObj.userJoin;
//         console.log(ContestObj);
//         let userContestObj = {
//             contestId: ContestObj._id,
//             userId: UserObj._id,
//         };
//         let userContestRes = await userContest(userContestObj).save();
//         if (userContestRes) {
//             let pointDescription = ContestObj.name + " Contest Joined with " + points + " Points";
//             let mobileDescription = "Contest";
//             await createPointlogs(req.user.userId, points, pointTransactionType.DEBIT, pointDescription, mobileDescription, "success");
//             let userPoints = {
//                 points: UserObj.points - parseInt(points),
//             };
//             if (userPoints?.points >= 0) {
//                 console.log(userPoints);
//                 await userModel.findByIdAndUpdate(req.user.userId, userPoints).exec();
//                 await Contest.findByIdAndUpdate(req.params.id, { userJoin: parseInt(userJoin) + 1 }).exec();
//             } else {
//                 throw { status: 400, message: "Insufficient balance" };
//             }
//         }
//         res.status(200).json({ message: "Contest Joined Sucessfully", success: true });
//     } catch (err) {
//         next(err);
//     }
// };

export const myContests = async (req, res, next) => {
    try {
        let getContest = await userContest.find({ userId: req.user.userId }).lean().exec();
        for (let Contestobj of getContest) {
            if (Contestobj?.contestId) {
                let contest = await Contest.findById(Contestobj?.contestId).exec();
                Contestobj.constest = contest;
            }
        }

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

// export const previousContest = async (req, res, next) => {
//     try {
//         let currentDate = new Date();
//         //for perivous Month First date
//         currentDate.setDate(0);
//         currentDate.setDate(1);
//         let previousFirstDate = currentDate;
//         //for previous month last date

//         currentDate = new Date();
//         currentDate.setDate(0);
//         let previousLastDate = currentDate;
//         console.log(previousFirstDate, previousLastDate);
//         let ContestObj = await Contest.findOne({ status: "CLOSED", endDate: { $gte: previousFirstDate, $lte: previousLastDate } })
//             .sort({ endDate: -1 })
//             .lean()
//             .exec();
//         if (ContestObj) {
//             let contestUsers = await userContest.find({ contestId: ContestObj._id, status: "win" }).lean().exec();
//             let contestPrizes = await Prize.find({ contestId: ContestObj._id }).sort({ rank: 1 }).lean().exec();
//             for (const user of contestPrizes) {
//                 let contestPrizes = await userContest.findOne({ contestId: user.contestId, rank: user.rank, status: "win" }).lean().exec();
//                 if (contestPrizes) {
//                     let userObj = await userModel.findById(contestPrizes.userId).exec();
//                     user.userObj = userObj;
//                 }
//             }
//             ContestObj.contestPrizes = contestPrizes;
//         }

//         res.status(200).json({ message: "getContest", data: ContestObj, success: true });
//     } catch (err) {
//         next(err);
//     }
// };

export const previousContest = async (req, res, next) => {
    try {
        let currentDate = new Date();
        // For the previous month's first date
        currentDate.setMonth(currentDate.getMonth() - 1);
        currentDate.setDate(1);
        let previousFirstDate = new Date(currentDate);

        // For the previous month's last date
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(0);
        let previousLastDate = new Date(currentDate);

        let ContestObj = await Contest.findOne({ status: "CLOSED", endDate: { $gte: previousFirstDate, $lte: previousLastDate } })
            .sort({ endDate: -1 })
            .lean()
            .exec();
        console.log(ContestObj);
        if (ContestObj) {
            let contestUsers = await userContest.find({ contestId: ContestObj._id, status: "win" }).lean().exec();
            let contestPrizes = await Prize.find({ contestId: ContestObj._id }).sort({ rank: 1 }).lean().exec();

            for (const user of contestPrizes) {
                let contestPrize = await userContest.findOne({ contestId: user.contestId, rank: user.rank, status: "win" }).lean().exec();

                if (contestPrize) {
                    let userObj = await userModel.findById(contestPrize.userId).exec();
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

export const currentContest1 = async (req, res, next) => {
    try {
        // Get the current date and time
        let currentDate = new Date();

        // Set the date to the first day of the previous month
        currentDate.setDate(1);
        currentDate.setHours(0, 0, 0, 0);
        let previousFirstDate = currentDate;

        console.log("---", previousFirstDate);
        // Set the date to the last day of the previous month
        currentDate = new Date();
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(0);

        let previousLastDate = currentDate;

        console.log("==", previousLastDate);
        // Find the most recent closed contest within the specified date range
        let ContestObj = await Contest.findOne({
            status: "CLOSED",
            endDate: { $gte: previousFirstDate, $lte: previousLastDate },
        })
            .sort({ endDate: -1 })
            .lean()
            .exec();

        if (ContestObj) {
            // Find all users who won the contest
            let contestWinners = await userContest.find({ contestId: ContestObj._id, status: "win" }).lean().exec();

            // Fetch additional details for each winner (e.g., user information)
            for (const winner of contestWinners) {
                let userObj = await userModel.findById(winner.userId).exec();
                winner.userObj = userObj;
            }

            // Attach the list of winners to the ContestObj
            ContestObj.contestWinners = contestWinners;
        }

        // Send the response with contest details and all winners
        res.status(200).json({ message: "getContest", data: ContestObj, success: true });
    } catch (err) {
        // Handle errors by passing them to the next middleware
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

        console.log(previousLastDate, "previousLastDate");
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

export const getCurrentContestRewards = async (req, res, next) => {
    try {
        // Get the current date and time
        const currentDateTime = new Date();

        // Find the most recent closed contest whose end date is before or equal to the current date
        const currentContest = await Contest.findOne({
            status: "CLOSED",
            endDate: { $lte: currentDateTime },
        })
            .select("name image") // Select both the contest name and image
            .sort({ endDate: -1 }) // Sort in descending order to get the most recent contest first
            .lean()
            .exec();

        if (!currentContest) {
            return res.status(404).json({ message: "No recent closed contest found", success: false });
        }

        // Find contest prizes for the current contest
        const currentContestPrizes = await Prize.find({ contestId: currentContest._id }).sort({ rank: 1 }).lean().exec();

        // Attach user details to the current contest prizes
        for (const prize of currentContestPrizes) {
            const winner = await userContest.findOne({ contestId: currentContest._id, rank: prize.rank, status: "win" }).populate("userId").lean().exec();
            prize.winnerDetails = winner?.userId ? await userModel.findById(winner.userId).select("name image -_id").lean().exec() : null;
        }

        // Include only the contest name and contest prizes with winner details in the response
        const responseData = {
            contestName: currentContest.name,
            contestPrizes: currentContestPrizes,
        };

        // Send the response
        res.status(200).json({ message: "Recent closed contest information retrieved successfully", data: responseData, success: true });
    } catch (err) {
        // Handle errors
        next(err);
    }
};

export const getPreviousContestRewards = async (req, res, next) => {
    try {
        // Get the current date and time
        const currentDateTime = new Date();

        // Find the most recent closed contest whose end date is before or equal to the current date
        const currentContest = await Contest.findOne({
            status: "CLOSED",
            endDate: { $lte: currentDateTime },
        })
            .select("name")
            .sort({ endDate: -1 }) // Sort in descending order to get the most recent contest first
            .lean()
            .exec();

        if (!currentContest) {
            return res.status(404).json({ message: "No recent closed contest found", success: false });
        }

        // Find the second most recent closed contest whose end date is before or equal to the current date
        const previousContest = await Contest.findOne({
            status: "CLOSED",
            endDate: { $lt: currentDateTime },
            _id: { $ne: currentContest._id }, // Exclude the ID of the current contest
        })
            .sort({ endDate: -1 }) // Sort in descending order to get the second most recent contest first
            .lean()
            .exec();

        if (!previousContest) {
            return res.status(404).json({ message: "No previous closed contest found", success: false });
        }

        // Find users who won the previous contest
        const previousContestUsers = await userContest.find({ contestId: previousContest._id, status: "win" }).lean().exec();

        // Find contest prizes for the previous contest
        const previousContestPrizes = await Prize.find({ contestId: previousContest._id }).sort({ rank: 1 }).lean().exec();

        // Attach user details to the previous contest prizes
        for (const prize of previousContestPrizes) {
            const winner = await userContest.findOne({ contestId: prize.contestId, rank: prize.rank, status: "win" }).populate("userId").lean().exec();
            prize.winnerDetails = winner?.userId ? await userModel.findById(winner.userId).select("name image -_id").lean().exec() : null;
        }
        const responseData = {
            contestName: currentContest.name,
            contestPrizes: previousContestPrizes,
        };
        // Send the response
        res.status(200).json({ message: "Previous closed contest information retrieved successfully", data: responseData, success: true });
    } catch (err) {
        // Handle errors
        next(err);
    }
};
