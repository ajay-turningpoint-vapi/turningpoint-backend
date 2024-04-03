import Contest from "../models/contest.model";
import userContest from "../models/userContest";
import userModel from "../models/user.model";
import Prize from "../models/prize.model";
import { sendNotificationLuckyDraw, sendNotificationMessage } from "../middlewares/fcm.middleware";

export const checkContest = async (date, time) => {
    try {
        let dateToBeComparedStart = new Date(date);
        dateToBeComparedStart.setHours(0, 0, 0);
        let dateToBeComparedEnd = new Date(date);
        dateToBeComparedEnd.setHours(23, 59, 59);

        // Find all contests that are approved and fall within the specified date and time range
        let allContests = await Contest.find({
            endTime: `${time}`.replace("-", ":"),
            endDate: { $gte: dateToBeComparedStart.getTime(), $lte: dateToBeComparedEnd.getTime() },
            status: "APPROVED",
        }).exec();

        for (const el of allContests) {
            try {
                // Fetch all prizes for the current contest and sort them by rank
                let contestPrizes = await Prize.find({ contestId: el._id }).sort({ rank: 1 }).lean().exec();

                // Fetch all users for the current contest
                let contestUsers = await userContest.find({ contestId: el._id }).lean().exec();

                // Filter contest users by status "join" and rank "0" (or any desired rank)
                let eligibleUsers = contestUsers.filter((user) => user.status === "join" && user.rank === "0");

                // Iterate over contest prizes and select random winner for each rank
                for (let prize of contestPrizes) {
                    // Filter eligible users by those who haven't won a prize yet for the current rank
                    let remainingEligibleUsers = eligibleUsers.filter((user) => user.rank !== prize.rank);
                    if (remainingEligibleUsers.length === 0) {
                        break; // No eligible users remaining for this rank
                    }

                    // Select random user from remaining eligible users
                    let randomWinner = remainingEligibleUsers[Math.floor(Math.random() * remainingEligibleUsers.length)];

                    // Update status to "win" and assign rank
                    await userContest.findByIdAndUpdate(randomWinner._id, { status: "win", rank: prize.rank }).exec();

                    // Remove winner from eligible users for this rank
                    eligibleUsers = eligibleUsers.filter((user) => user._id !== randomWinner._id);
                }

                // Update status of remaining users to "lose"
                await userContest.updateMany({ contestId: el._id, status: "join" }, { status: "lose" }).exec();

                // Close the contest
                await Contest.findByIdAndUpdate(el._id, { status: "CLOSED" }).exec();

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
                        console.log("users======", user);
                        const title = "Lucky Draw! Lucky Draw Result in 5 Minutes";
                        const body = `Get ready! The lucky draw result will be announced in just 5 minutes.`;
                        await sendNotificationMessage(user._id, title, body);
                    } catch {
                        console.error("Error sending notification for user:", user._id, error);
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
export const checkContest1 = async (date, time) => {
    try {
        let dateToBeComparedStart = new Date(date);
        dateToBeComparedStart.setHours(0, 0, 0);
        let dateToBeComparedEnd = new Date(date);
        dateToBeComparedEnd.setHours(23, 59, 59);

        // Find contests that are still open and have an "APPROVED" status
        let openContests = await Contest.find({
            endTime: `${time}`.replace("-", ":"),
            endDate: { $gte: dateToBeComparedStart.getTime(), $lte: dateToBeComparedEnd.getTime() },
            status: "APPROVED",
        }).exec();

        for (const el of openContests) {
            try {
                // Atomically update the status of the contest while checking its previous status
                const updatedContest = await Contest.findOneAndUpdate({ _id: el._id, status: "APPROVED" }, { $set: { status: "PROCESSING" } }, { new: true }).exec();

                // If the contest was not updated (i.e., its status was changed by another instance),
                // skip processing and move to the next contest
                if (!updatedContest) {
                    console.log(`Contest ${el._id} is already being processed by another instance.`);
                    continue;
                }

                // Continue processing the contest...

                let contestPrizes = await Prize.find({ contestId: el._id }).sort({ rank: 1 }).lean().exec();
                let contestUsers = await userContest.find({ contestId: el._id, status: "join" }).lean().exec();

                // Track allocated prize IDs
                let allocatedPrizeIds = new Set();

                // Check if there are available prizes and users joined
                if (contestPrizes.length > 0 && contestUsers.length > 0) {
                    for (let prize of contestPrizes) {
                        if (!contestUsers.length) {
                            break;
                        }

                        // Check if the prize has already been allocated
                        if (allocatedPrizeIds.has(prize._id)) {
                            continue; // Skip this prize
                        }

                        // Allocate the prize to a random user
                        var randomItem = contestUsers[Math.floor(Math.random() * contestUsers.length)];
                        await userContest.findByIdAndUpdate(randomItem._id, { status: "win", rank: prize?.rank }).exec();
                        contestUsers = contestUsers.filter((el) => `${el._id}` != `${randomItem._id}`);

                        // Add the allocated prize ID to the set
                        allocatedPrizeIds.add(prize._id);
                    }
                }

                // Update status of remaining joined users to "lose"
                await userContest.updateMany({ contestId: el._id, status: "join" }, { status: "lose" }).exec();

                // Close the contest
                await Contest.findByIdAndUpdate(updatedContest._id, { status: "CLOSED" }).exec();

                for (const user of contestUsers) {
                    await sendNotificationLuckyDraw(user._id);
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
