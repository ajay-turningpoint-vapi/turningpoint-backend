import express from "express";
const path = require("path");
let router = express.Router();
const indexPath = path.join(__dirname, "../", "index.html");
router.get("/", function (req, res, next) {
    res.sendFile(indexPath);
});

export default router;
