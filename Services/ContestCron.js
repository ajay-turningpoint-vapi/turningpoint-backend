import Contest from "../models/contest.model";
import userContest from "../models/userContest";
import userModel from "../models/user.model";
import Prize from "../models/prize.model";
import { sendNotificationMessage } from "../middlewares/fcm.middleware";

export const checkContest = async (date, time) => {
    try {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59);

        const openContests = await Contest.find({
            antimationTime: `${time}`.replace("-", ":"),
            endDate: { $gte: startDate, $lte: endDate },
            status: "APPROVED",
        }).exec();

        if (openContests.length === 0) {
            console.log("No contests found.");
            return;
        }

        console.log("List of contests:", openContests);

        for (const contest of openContests) {
            const updatedContest = await Contest.findOneAndUpdate({ _id: contest._id, status: "APPROVED" }, { $set: { status: "PROCESSING" } }, { new: true }).exec();

            if (!updatedContest) {
                console.log(`Contest ${contest._id} is already being processed by another instance.`);
                continue;
            }

            const [contestPrizes, contestUsers] = await Promise.all([Prize.find({ contestId: contest._id }).sort({ rank: 1 }).lean().exec(), userContest.find({ contestId: contest._id, status: "join" }).lean().exec()]);

            const allocatedPrizeIds = new Set();

            if (contestPrizes.length > 0 && contestUsers.length > 0) {
                for (let prize of contestPrizes) {
                    if (!contestUsers.length) break;
                    if (allocatedPrizeIds.has(prize._id)) continue;

                    const randomIndex = Math.floor(Math.random() * contestUsers.length);
                    const randomUser = contestUsers[randomIndex];

                    await userContest.findByIdAndUpdate(randomUser._id, { status: "win", rank: prize.rank }).exec();
                    contestUsers.splice(randomIndex, 1); // Remove the user from the array
                    allocatedPrizeIds.add(prize._id);
                }
            }

            if (contestUsers.length > 0) {
                await userContest.updateMany({ contestId: contest._id, status: "join" }, { status: "lose" }).exec();
            }

            await Contest.findByIdAndUpdate(updatedContest._id, { status: "CLOSED" }).exec();
        }

        console.log(startDate.getTime(), time);
        console.log("CronEnd");
    } catch (error) {
        console.error("Error in checkContest:", error);
    }
};
