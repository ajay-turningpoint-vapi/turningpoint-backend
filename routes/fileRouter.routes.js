const { Router } = require("express");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { v4: uuidv4 } = require("uuid");
const { S3Client } = require("@aws-sdk/client-s3");
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

const handleFileUpload = async (req, res, next) => {
    try {
        const fileUrls = [];

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                fileUrls.push(file.location);
            }
        }

        req.fileUrls = fileUrls;
        next();
    } catch (error) {
        next(error);
    }
};

const provideFileUrls = (req, res) => {
    res.status(200).json(req.fileUrls);
};

// Route configuration using the router instance
router.post("/upload", upload.array("images"), handleFileUpload, provideFileUrls);

// Export the router
module.exports = router;
