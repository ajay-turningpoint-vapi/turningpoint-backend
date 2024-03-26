import Contest from "../models/contest.model";
import userContest from "../models/userContest";
import userModel from "../models/user.model";
import Prize from "../models/prize.model";

// export const checkContest = async (date, time) => {
//     try {
//         let dateToBeComparedStart = new Date(date);
//         dateToBeComparedStart.setHours(0, 0, 0);
//         let dateToBeComparedEnd = new Date(date);
//         dateToBeComparedEnd.setHours(23, 59, 59);
//         let allContests = await Contest.find({ endTime: `${time}`.replace("-", ":"), endDate: { $gte: dateToBeComparedStart.getTime(), $lte: dateToBeComparedEnd.getTime() } }).exec();
//         console.log(allContests, "list of contest");
//         for (const el of allContests) {
//             try {
//                 let contestPrizes = await Prize.find({ contestId: el._id }).sort({ rank: 1 }).lean().exec();
//                 console.log(contestPrizes, "constest prize");
//                 let contestUsers = await userContest.find({ contestId: el._id }).lean().exec();
//                 if (contestPrizes.length > 0 && contestUsers.length > 0) {
//                     for (let prize of contestPrizes) {
//                         if (!contestUsers.length) {
//                             break;
//                         }
//                         var randomItem = contestUsers[Math.floor(Math.random() * contestUsers.length)];
//                         await userContest.findByIdAndUpdate(randomItem._id, { status: "win", rank: prize?.rank }).exec();
//                         contestUsers = contestUsers.filter((el) => `${el._id}` != `${randomItem._id}`);
//                     }
//                 }
//                 const test = await userContest.updateMany({ contestId: el._id, status: "join" }, { status: "lose" }).exec();
//                 await Contest.findByIdAndUpdate(el._id, { status: "CLOSED" }).exec();
//             } catch (err) {
//                 console.error(err);
//             }
//         }
//         console.log(dateToBeComparedStart.getTime(), time);
//         console.log("CronEnd");
//     } catch (error) {
//         consoler.error(error);
//     }
// };
export const checkContest = async (date, time) => {
    try {
        let dateToBeComparedStart = new Date(date);
        dateToBeComparedStart.setHours(0, 0, 0);
        let dateToBeComparedEnd = new Date(date);
        dateToBeComparedEnd.setHours(23, 59, 59);
        let allContests = await Contest.find({ endTime: `${time}`.replace("-", ":"), endDate: { $gte: dateToBeComparedStart.getTime(), $lte: dateToBeComparedEnd.getTime() } }).exec();

        for (const contest of allContests) {
            try {
                let contestPrizes = await Prize.find({ contestId: contest._id }).sort({ rank: 1 }).lean().exec();
                let contestUsers = await userContest.find({ contestId: contest._id }).lean().exec();

                // Calculate total entries for each user
                let userEntries = {};
                for (const user of contestUsers) {
                    if (!userEntries[user.userId]) {
                        userEntries[user.userId] = 0;
                    }
                    userEntries[user.userId]++;
                }

                // Sort user entries in descending order
                let sortedUserEntries = Object.entries(userEntries).sort((a, b) => b[1] - a[1]);

                // Assign prizes to users based on available entries and prize ranking
                let prizeIndex = 0;
                for (const [userId, entries] of sortedUserEntries) {
                    if (prizeIndex >= contestPrizes.length) {
                        // Break if all prizes have been awarded
                        break;
                    }
                    for (let i = 0; i < entries && prizeIndex < contestPrizes.length; i++) {
                        // Update userContest entry as winner for current prize
                        await userContest.findOneAndUpdate({ contestId: contest._id, userId: userId, status: "join" }, { status: "win", rank: contestPrizes[prizeIndex].rank }).exec();
                        prizeIndex++;
                    }
                }

                // Update remaining joiners as losers
                await userContest.updateMany({ contestId: contest._id, status: "join" }, { status: "lose" }).exec();

                // Mark contest as CLOSED
                await Contest.findByIdAndUpdate(contest._id, { status: "CLOSED" }).exec();
            } catch (err) {
                console.error(err);
            }
        }
        console.log("CronEnd");
    } catch (error) {
        console.error(error);
    }
};
