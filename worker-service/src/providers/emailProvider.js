import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import dotenv from "dotenv";

dotenv.config();

const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

export async function sendEmail(payload) {
  try {
    console.log("📨 Email payload received:", payload);

    //  Safety validation
    if (!payload.to || !payload.subject || !payload.text) {
      throw new Error("Invalid email payload");
    }

    const params = {
      Source: process.env.SES_FROM_EMAIL, 
      Destination: {
        ToAddresses: [payload.to],
      },
      Message: {
        Subject: {
          Data: payload.subject,
          Charset: "UTF-8",
        },
        Body: {
          Text: {
            Data: payload.text,
            Charset: "UTF-8",
          },
        },
      },
    };

    console.log(" SES params:", params);

    const result = await ses.send(new SendEmailCommand(params));

    console.log(" Email sent via SES:", result.MessageId);

    return result;

  } catch (error) {
    console.error("❌ SES Error:", error.message);
    throw error; // important for retry logic
  }
}
