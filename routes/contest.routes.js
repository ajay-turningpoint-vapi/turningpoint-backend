import express from "express";
import { addContest, deleteById, getContest, getContestById, updateById, joinContest, myContests, luckyDraw, previousContest, currentContest } from "../controllers/contest.controller";
let router = express.Router();
import { authorizeJwt } from "../middlewares/auth.middleware";

router.post("/addContest", addContest);

router.get("/getContestById/:id", getContestById);
router.get("/getContest", authorizeJwt, getContest);

router.patch("/updateById/:id", updateById);

router.delete("/deleteById/:id", deleteById);

router.get("/joinContest/:id", authorizeJwt, joinContest);
router.get("/myContests", authorizeJwt, myContests);
router.post("/luckyDraw/:id", authorizeJwt, luckyDraw);
router.get("/previousContest", authorizeJwt, previousContest);
router.get("/currentContest", authorizeJwt, currentContest);

export default router;
