export async function sendPush(payload) {
  console.log(" Sending Push:", payload);

  await new Promise((res) => setTimeout(res, 2000));
}