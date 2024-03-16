const { Router } = require("express");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { v4: uuidv4 } = require("uuid");
const { S3Client } = require("@aws-sdk/client-s3");
const compression = require("compression");
const { LRUCache } = require("lru-cache");
const path = require("path");

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
const cache = new LRUCache({
    max: 100, // Maximum number of items to store
    maxAge: 1000 * 60 * 10, // Maximum age of items in milliseconds (10 minutes)
});
const handleFileUpload = async (req, res, next) => {
    try {
        const fileUrls = [];

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                fileUrls.push(file.location);
            }
        }
        req.fileUrls = fileUrls;
        cache.set(req.originalUrl, fileUrls);

        next();
    } catch (error) {
        next(error);
    }
};

const provideFileUrls = (req, res) => {
    const cachedUrls = cache.get(req.originalUrl);
    if (cachedUrls) {
        // If file URLs are cached, return them directly
        res.status(200).json(cachedUrls);
    } else {
        // If file URLs are not cached, proceed as usual
        res.status(200).json(req.fileUrls);
    }
};
router.use(compression());
// Route configuration using the router instance
router.post("/upload", upload.array("images"), handleFileUpload, provideFileUrls);

// Export the router
module.exports = router;
