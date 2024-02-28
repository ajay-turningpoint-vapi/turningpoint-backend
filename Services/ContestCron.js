import Contest from "../models/contest.model";
import userContest from "../models/userContest";
import userModel from "../models/user.model";
import Prize from "../models/prize.model";


export const checkContest = async (date, time) => {
    try {
        let dateToBeComparedStart = new Date(date)
        dateToBeComparedStart.setHours(0, 0, 0)
        let dateToBeComparedEnd = new Date(date)
        dateToBeComparedEnd.setHours(23, 59, 59)
        let allContests = await Contest.find({ endTime: `${time}`.replace("-",":"), endDate: { $gte: dateToBeComparedStart.getTime(), $lte: dateToBeComparedEnd.getTime() } }).exec()
        for (const el of allContests) {
            try {
                let contestPrizes = await Prize.find({ contestId: el._id }).sort({ rank: 1 }).lean().exec();
                console.log(contestPrizes,"constest prize")
                let contestUsers = await userContest.find({ contestId: el._id }).lean().exec();
                if (contestPrizes.length > 0 && contestUsers.length > 0) {
                    for (let prize of contestPrizes) {
                        if (!contestUsers.length) {
                            break;
                        }
                        var randomItem = contestUsers[Math.floor(Math.random() * contestUsers.length)];
                        await userContest.findByIdAndUpdate(randomItem._id, { status: "win", rank: prize?.rank }).exec();
                        contestUsers = contestUsers.filter(el => `${el._id}` != `${randomItem._id}`);
                    }
                }
                await userContest.updateMany({ contestId: el._id, status: "join" }, { status: "lose" }).exec();
                await Contest.findByIdAndUpdate(el._id, { status: "CLOSED" }).exec();
            }
            catch (err) {
                console.error(err)
            }
        }
        console.log(dateToBeComparedStart.getTime(), time);
        console.log("CronEnd");
    } catch (error) {
        consoler.error(error)
    }
}