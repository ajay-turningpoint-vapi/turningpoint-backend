import Contest from "../models/contest.model";
import userContest from "../models/userContest";
import userModel from "../models/user.model";
import Prize from "../models/prize.model";
import { sendNotificationMessage } from "../middlewares/fcm.middleware";

export const checkContest = async (date, time) => {
    try {
        let dateToBeComparedStart = new Date(date);
        dateToBeComparedStart.setHours(0, 0, 0);
        let dateToBeComparedEnd = new Date(date);
        dateToBeComparedEnd.setHours(23, 59, 59);
        let openContests = await Contest.find({
            antimationTime: `${time}`.replace("-", ":"),
            endDate: { $gte: dateToBeComparedStart.getTime(), $lte: dateToBeComparedEnd.getTime() },
            status: "APPROVED",
        }).exec();
        console.log("litst of contest", openContests);
        for (const el of openContests) {
            try {
              
                const updatedContest = await Contest.findOneAndUpdate({ _id: el._id, status: "APPROVED" }, { $set: { status: "PROCESSING" } }, { new: true }).exec();

                if (!updatedContest) {
                    console.log(`Contest ${el._id} is already being processed by another instance.`);
                    continue;
                }

            

                let contestPrizes = await Prize.find({ contestId: el._id }).sort({ rank: 1 }).lean().exec();
                let contestUsers = await userContest.find({ contestId: el._id, status: "join" }).lean().exec();

            
                let allocatedPrizeIds = new Set();

               
                if (contestPrizes.length > 0 && contestUsers.length > 0) {
                    for (let prize of contestPrizes) {
                        if (!contestUsers.length) {
                            break;
                        }

                       
                        if (allocatedPrizeIds.has(prize._id)) {
                            continue; 
                        }

                      
                        var randomItem = contestUsers[Math.floor(Math.random() * contestUsers.length)];
                        await userContest.findByIdAndUpdate(randomItem._id, { status: "win", rank: prize?.rank }).exec();
                        contestUsers = contestUsers.filter((el) => `${el._id}` != `${randomItem._id}`);

                      
                        allocatedPrizeIds.add(prize._id);
                    }
                }

               
                await userContest.updateMany({ contestId: el._id, status: "join" }, { status: "lose" }).exec();

              
                await Contest.findByIdAndUpdate(updatedContest._id, { status: "CLOSED" }).exec();

                const userData = await userModel
                    .find({
                        $and: [
                            { role: { $ne: "ADMIN" } }, // Exclude users with role 'admin'
                            { name: { $ne: "Contractor" } }, // Exclude users with name 'rohit'
                        ],
                    })
                    .lean()
                    .exec();
                for (const user of userData) {
                    try {
                        const title = "🎉 Get Ready for the Lucky Draw!";
                        const body = `🍀 Feeling lucky? The moment of truth is near! In just few minutes, we'll be announcing the winners of our exciting lucky draw. 🏆 Don't miss out on your chance to win fabulous prizes! Stay tuned and keep those fingers crossed! 🤞✨`;
                        await sendNotificationMessage(user._id, title, body);
                    } catch {
                      
                    }
                }
            } catch (err) {
                console.error(err);
            }
        }

        console.log(dateToBeComparedStart.getTime(), time);
        console.log("CronEnd");
    } catch (error) {
        console.error(error);
    }
};
