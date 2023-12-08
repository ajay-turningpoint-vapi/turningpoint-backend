import express from "express";
import { getLikeCount, likeReels } from "../controllers/reelsLikes.controller";
import { authorizeJwt } from "../middlewares/auth.middleware";
let router = express.Router();

router.post("/like", authorizeJwt, likeReels);
router.post("/getLikeCount", authorizeJwt, getLikeCount);


export default router;
