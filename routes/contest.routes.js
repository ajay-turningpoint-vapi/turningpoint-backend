import express from "express";
import {
    addContest,
    deleteById,
    getContest,
    getContestById,
    updateById,
    joinContest,
    myContests,
    luckyDraw,
    previousContest,
    currentContest,
    getContestAdmin,
    getCurrentContest,
    getCurrentContestRewards,
    getPreviousContestRewards,
    joinContestByCoupon,
} from "../controllers/contest.controller";
let router = express.Router();
import { authorizeJwt } from "../middlewares/auth.middleware";

router.post("/addContest", addContest);

router.get("/getContestById/:id", getContestById);
router.get("/getContest", authorizeJwt, getContest);
router.get("/getContestAdmin", authorizeJwt, getContestAdmin);
router.patch("/updateById/:id", updateById);
router.delete("/deleteById/:id", deleteById);
// router.get("/joinContest/:id", authorizeJwt, joinContest);
router.get("/joinContest/:id", authorizeJwt, joinContestByCoupon);
router.get("/myContests", authorizeJwt, myContests);
router.get("/getCurrentContest", authorizeJwt, getCurrentContest);
router.post("/luckyDraw/:id", authorizeJwt, luckyDraw);
router.get("/previousContest", authorizeJwt, previousContest);
router.get("/currentContest", authorizeJwt, currentContest);
router.get("/currentContestRewards", getCurrentContestRewards);
router.get("/previousContestRewards", getPreviousContestRewards);
export default router;
