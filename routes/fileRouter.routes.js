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
    limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB limit
    },
});

const cloudFrontDomain = "https://d1m2dthq0rpgme.cloudfront.net";

router.post("/upload", (req, res, next) => {
    // Check if file size exceeds the limit
    if (req.file && req.file.size > 20 * 1024 * 1024) {
        return res.status(400).json({ error: "File size exceeds the limit (20 MB)" });
    }
    // Handle file upload
    upload.array("images")(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Multer error
            return res.status(400).json({ error: err.message });
        } else if (err) {
            // Other errors
            return res.status(500).json({ error: "Internal Server Error" });
        }

        // Retrieve uploaded files and construct CloudFront URLs
        const fileUrls = req.files.map((file) => `${cloudFrontDomain}/${file.key}`);
        res.status(200).json( fileUrls );
    });
});

module.exports = router;
