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
  const params = {
    Source: "singhdevansh4747@gmail.com", 
    Destination: {
      ToAddresses: [payload.email],
    },
    Message: {
      Subject: { Data: payload.subject },
      Body: {
        Text: { Data: payload.message },
      },
    },
  };

  await ses.send(new SendEmailCommand(params));

  console.log(" Email sent via SES");
}