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
  console.log(" Email payload received:", payload);

  const params = {
    Source: "singhdevansh4747@gmail.com",
    Destination: {
      ToAddresses: [payload.to], 
    },
    Message: {
      Subject: { Data: payload.subject },
      Body: {
        Text: { Data: payload.text }, 
      },
    },
  };

  console.log(" SES params:", params); 

  await ses.send(new SendEmailCommand(params));

  console.log(" Email sent via SES");
}
