export async function sendSMS(payload) {
  console.log("📱 Mock SMS:", payload);

  await new Promise((res) => setTimeout(res, 1000));
}