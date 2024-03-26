const { Router } = require("express");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { LRUCache } = require("lru-cache");
const { v4: uuidv4 } = require("uuid");
const { S3Client } = require("@aws-sdk/client-s3");
const path = require("path");
const compression = require("compression");
const router = Router();

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: process.env.AWS_S3_BUCKET_NAME,
        key: (req, file, cb) => {
            const fileExtension = path.extname(file.originalname);
            const fileName = uuidv4() + fileExtension;
            cb(null, fileName);
        },
    }),
});
const cache = new LRUCache({ max: 1000 });

const cloudFrontDomain = "https://d1m2dthq0rpgme.cloudfront.net";

const handleFileUpload = async (req, res, next) => {
    try {
        // Retrieve uploaded files and construct CloudFront URLs
        const fileUrls = req.files.map((file) => `${cloudFrontDomain}/${file.key}`);

        // Cache the fileUrls for future requests (if needed)
        cache.set("fileUrls", fileUrls);

        req.fileUrls = fileUrls;
        next();
    } catch (error) {
        next(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
// const handleFileUpload = async (req, res, next) => {
//     try {
//         // Check if URLs are already cached
//         const cachedUrls = cache.get("fileUrls");

//         if (cachedUrls) {
//             req.fileUrls = cachedUrls;
//         } else {
//             const fileUrls = [];

//             if (req.files && req.files.length > 0) {
//                 for (const file of req.files) {
//                     fileUrls.push(file.location);
//                 }
//             }

//             req.fileUrls = fileUrls;

//             // Cache the fileUrls for future requests
//             cache.set("fileUrls", fileUrls);
//         }

//         next();
//     } catch (error) {
//         next(error);
//     }
// };

const provideFileUrls = (req, res) => {
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 year
    res.status(200).json(req.fileUrls);
};
router.use(compression());

router.post("/upload", upload.array("images"), handleFileUpload, provideFileUrls);
module.exports = router;
