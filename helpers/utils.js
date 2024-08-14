import { customAlphabet } from "nanoid";
import User from "../models/user.model";
import axios from "axios";
const AWS = require("aws-sdk");
import { CONFIG } from "../helpers/Config";
const apiKey = CONFIG.API_KEY;
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});
const sns = new AWS.SNS();

export const UserActiveSMS = async (req, res, next) => {
    console.log(req.body);

    try {
        const { name, phone } = req.body;
        const profileUrl = "http://api.turningpointvapi.com/Users-list";
        const params = {
            Message: `
Hello Admin,
            
A new user has registered on Turning Point App. 
Please verify and approve the profile. 

Name: ${name} Phone:  ${phone} 

You can view the user's profile here: ${profileUrl}

Thank you,
Turning Point Team`,

            TopicArn: process.env.SNS_TOPIC_ARN,
        };

        sns.publish(params, (err, data) => {
            if (err) {
                console.log(err, err.stack);
                // res.status(500).send("Error sending SMS");
            } else {
                // res.status(200).send("User registered and SMS sent");
            }
        });
    } catch (err) {
        console.log(err);
        next(err);
    }
};

export const UserKycSMS = async (req, res, next) => {
    try {
        const { name, phone, _id } = req.body;
        const kycUrl = "http://api.turningpointvapi.com/Users-list";
        const params = {
            Message: `
Hello Admin,
            
A new user has submitted KYC for the Turning Point App. 
Please verify and approve. 

Name: ${name} Phone:  ${phone} 
       
You can view the KYC details here: ${kycUrl}

Thank you,
Turning Point Team`,

            TopicArn: process.env.SNS_TOPIC_ARN,
        };

        sns.publish(params, (err, data) => {
            if (err) {
                console.log(err, err.stack);
                res.status(500).send("Error sending SMS");
            } else {
                res.status(200).send("User registered and SMS sent");
            }
        });
    } catch (err) {
        console.log(err);
        next(err);
    }
};

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

export const generateUid = async () => {
    let check = true;
    while (check) {
        let tempUid = nanoid();
        let userObj = await User.findOne({ uid: tempUid }).exec();
        if (!userObj) {
            check = false;
            return tempUid;
        }
        console.log("GENERATING NEW UID,Current", tempUid);
    }
};

export const randomNumberGenerator = () => {
    const values = [100, 200, 300, 400, 500];
    const randomIndex = Math.floor(Math.random() * values.length);
    return values[randomIndex];
};

export const generateRandomWord = (length) => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let randomWord = "TP" + "";
    for (let i = 0; i < length; i++) {
        randomWord += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return randomWord;
};

export async function sendWhatsAppMessage(templateName, to, body_1, body_2, body_3) {
    const payload = {
        integrated_number: "918200025803",
        content_type: "template",
        payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
                name: templateName,
                language: {
                    code: "en",
                    policy: "deterministic",
                },
                namespace: null,
                to_and_components: [
                    {
                        to: [to],
                        components: {
                            body_1: {
                                type: "text",
                                value: body_1,
                            },
                            body_2: {
                                type: "text",
                                value: body_2,
                            },
                            body_3: {
                                type: "text",
                                value: body_3,
                            },
                        },
                    },
                ],
            },
        },
    };

    try {
        const response = await axios.post("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", payload, {
            headers: {
                authkey: `418451AzKt9qoMmlL664c674fP1`,
                "Content-Type": "application/json",
            },
        });

        return response.data;
        
    } catch (error) {
        console.error("Error sending WhatsApp message:", error);
    }
}
