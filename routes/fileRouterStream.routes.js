const express = require("express");
const multer = require("multer");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { MediaConvertClient, CreateJobCommand, GetJobCommand, DeleteJobCommand } = require('@aws-sdk/client-mediaconvert');
const uuid = require("uuid");
const path = require("path");
const fs = require("fs");
const { error } = require("console");
const router = express.Router();

// Initialize AWS SDK v3 with correct region
const REGION = 'ap-south-1';  // Replace with your bucket's region
const s3 = new S3Client({ region: REGION });
const mediaConvert = new MediaConvertClient({ region: REGION });

const BUCKET_NAME = "turningpoint-videos";
const MEDIA_CONVERT_ROLE = "arn:aws:iam::847905139396:role/vidoeCovertStream";

// Multer configuration for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage: storage });

router.post("/upload-video", upload.single("video"), async (req, res) => {
    if (!req.file) {
        return res.status(400).send({ message: "No file uploaded." });
    }

    const inputFilePath = req.file.path;
    const inputFileName = req.file.filename;
    let s3FileUrl;
    let mediaConvertJob;

    try {
        // Step 1: Upload video to S3
        const uploadParams = {
            Bucket: BUCKET_NAME,
            Key: `reels/${inputFileName}`,
            Body: fs.readFileSync(inputFilePath),
            ContentType: req.file.mimetype,
        };

        const uploadCommand = new PutObjectCommand(uploadParams);
        const s3UploadResult = await s3.send(uploadCommand);

        // Get the S3 URL for the uploaded file
        s3FileUrl = `s3://${BUCKET_NAME}/reels/${inputFileName}`;

        // Step 2: Prepare MediaConvert Job
        const outputFolder = `convertedReels/${uuid.v4()}/`;
        const mediaConvertJobParams = {
            Role: MEDIA_CONVERT_ROLE,
            Settings: {
                Inputs: [
                    {
                        FileInput: s3FileUrl,
                        AudioSelectors: {
                            "Audio Selector 1": {
                                DefaultSelection: "DEFAULT",
                            },
                        },
                    },
                ],
                OutputGroups: [
                    {
                        OutputGroupSettings: {
                            Type: "HLS_GROUP_SETTINGS",
                            HlsGroupSettings: {
                                SegmentLength: 10,
                                MinSegmentLength: 2,
                                DirectoryStructure: "SINGLE_DIRECTORY",
                                ManifestCompression: "NONE",
                                ManifestDurationFormat: "INTEGER",
                                SegmentControl: "SEGMENTED_FILES",
                                Destination: `s3://${BUCKET_NAME}/${outputFolder}`,
                            },
                        },
                        Outputs: [
                            {
                                VideoDescription: {
                                    CodecSettings: {
                                        Codec: "H_264",
                                        H264Settings: {
                                            RateControlMode: "CBR", // Constant Bitrate
                                            Bitrate: 2000000, // 2000 kbps (for lower quality)
                                            GopSize: 2, // GOP size for keyframes
                                            GopSizeUnits: "SECONDS",
                                            GopClosedCadence: 1,
                                            CodecLevel: "AUTO",
                                            CodecProfile: "MAIN",
                                            FramerateControl: "SPECIFIED",
                                            FramerateNumerator: 30000,
                                            FramerateDenominator: 1001, // 29.97 fps
                                            ParControl: "SPECIFIED",
                                            ParNumerator: 9,
                                            ParDenominator: 16, // Aspect ratio 9:16 (vertical)
                                            NumberBFramesBetweenReferenceFrames: 2,
                                        },
                                    },
                                    Width: 1080,  // Set for vertical resolution (9:16 aspect ratio)
                                    Height: 1920, // 1080x1920 (portrait mode)
                                    ScalingBehavior: "STRETCH_TO_OUTPUT", // Ensure it fills the output resolution
                                    PaddingControl: "NONE", // No padding (no black bars)
                                    AfdSignaling: "NONE", // No additional padding for full screen
                                },
                                AudioDescriptions: [
                                    {
                                        CodecSettings: {
                                            Codec: "AAC",
                                            AacSettings: {
                                                Bitrate: 128000, // 128 kbps
                                                CodingMode: "CODING_MODE_2_0", // Stereo
                                                SampleRate: 44100, // 44.1 kHz
                                            },
                                        },
                                        AudioSourceName: "Audio Selector 1",
                                    },
                                ],
                                ContainerSettings: {
                                    Container: "M3U8", // HLS output format
                                    M3u8Settings: {
                                        AudioFramesPerPes: 4,
                                        PcrControl: "PCR_EVERY_PES_PACKET",
                                    },
                                },
                                NameModifier: `-${uuid.v4()}`,
                            },
                        ],
                    },
                ],
            },
        };
        
        

        const createJobCommand = new CreateJobCommand(mediaConvertJobParams);
        mediaConvertJob = await mediaConvert.send(createJobCommand);

        // Step 3: Poll for job completion
        let jobStatus = "SUBMITTED";
        while (jobStatus === "SUBMITTED" || jobStatus === "PROGRESSING") {
            await new Promise(resolve => setTimeout(resolve, 30000));  // Delay between status checks
            const getJobCommand = new GetJobCommand({ Id: mediaConvertJob.Job.Id });
            const jobDetails = await mediaConvert.send(getJobCommand);
            jobStatus = jobDetails.Job.Status;
        }

        // Step 4: Handle job result
        if (jobStatus === "COMPLETE") {
            // Get the base URL for the .m3u8 file
            const m3u8FileName = `${mediaConvertJob.Job.Id.split('-')[0]}.m3u8`;  // Extract the job ID for the filename
            const m3u8Url = `https://d3w4ckughtbnto.cloudfront.net/${outputFolder}${m3u8FileName}`;

            // Respond with the .m3u8 file URL
            res.status(200).send({
                message: "Video upload and conversion completed successfully.",
                jobId: mediaConvertJob.Job.Id,
                m3u8Url: m3u8Url,  // Send the m3u8 URL to store in your database
            });
        } else {
            throw new Error("Video conversion failed.");
        }

    } catch (error) {
        console.error("Error processing video:", error);

        // Step 5: Rollback logic
        try {
            // Delete the video from S3 if upload was successful but conversion failed
            if (s3FileUrl) {
                const deleteParams = {
                    Bucket: BUCKET_NAME,
                    Key: `reels/${inputFileName}`,
                };
                const deleteCommand = new DeleteObjectCommand(deleteParams);
                await s3.send(deleteCommand);
            }

            // Cancel the MediaConvert job if it was started
            if (mediaConvertJob) {
                const deleteJobCommand = new DeleteJobCommand({ Id: mediaConvertJob.Job.Id });
                await mediaConvert.send(deleteJobCommand);
            }

            res.status(500).send({
                message: "Error uploading or converting video.",
                error: error.message,
            });
        } catch (rollbackError) {
            console.error("Error during rollback:", rollbackError);
            res.status(500).send({
                message: "Error occurred during rollback.",
                error: rollbackError.message,
            });
        }
    }
});

module.exports = router;
