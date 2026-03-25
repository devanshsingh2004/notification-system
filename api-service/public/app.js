const API_URL = window.location.origin; //  auto works for local + EC2

let token = "";
let currentType = "EMAIL";

function selectTab(type) {
  currentType = type;
  renderForm();
}

//  Render dynamic form
function renderForm() {
  const form = document.getElementById("form");

  if (currentType === "EMAIL") {
    form.innerHTML = `
      <input id="email" placeholder="Recipient Email" />
      <input id="subject" placeholder="Subject" />
      <textarea id="message" placeholder="Message"></textarea>
    `;
  }

  if (currentType === "SMS") {
    form.innerHTML = `
      <input id="phone" placeholder="Phone Number" />
      <textarea id="message" placeholder="Message"></textarea>
    `;
  }

  if (currentType === "PUSH") {
    form.innerHTML = `
      <input id="tokenInput" placeholder="Device Token" />
      <input id="title" placeholder="Title" />
      <textarea id="message" placeholder="Message"></textarea>
    `;
  }
}

//  Login (only once)
async function login() {
  if (token) return;

  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@gmail.com" }),
  });

  const data = await res.json();
  token = data.accessToken;
}

//  Timeline UI
function updateTimeline(status) {
  const steps = ["queued", "processing", "delivered"];

  steps.forEach((step) => {
    document.getElementById(step).innerText = `⚪ ${step}`;
  });

  if (status === "QUEUED") {
    document.getElementById("queued").innerText = "🟡 Queued";
  }

  if (status === "PROCESSING") {
    document.getElementById("queued").innerText = "🟢 Queued";
    document.getElementById("processing").innerText = "🟡 Processing";
  }

  if (status === "SENT") {
    document.getElementById("queued").innerText = "🟢 Queued";
    document.getElementById("processing").innerText = "🟢 Processing";
    document.getElementById("delivered").innerText = "🟢 Delivered";
  }

  if (status === "FAILED") {
    document.getElementById("delivered").innerText = "🔴 Failed";
  }
}

//  Send Notification
async function sendNotification() {
  await login();

  let payload = {};

  if (currentType === "EMAIL") {
    payload = {
      email: document.getElementById("email").value,
      subject: document.getElementById("subject").value,
      message: document.getElementById("message").value,
    };
  }

  if (currentType === "SMS") {
    payload = {
      phoneNumber: document.getElementById("phone").value,
      message: document.getElementById("message").value,
    };
  }

  if (currentType === "PUSH") {
    payload = {
      deviceToken: document.getElementById("tokenInput").value,
      title: document.getElementById("title").value,
      body: document.getElementById("message").value,
    };
  }

  const idempotencyKey = Date.now().toString();

  //  show immediate feedback
  updateTimeline("QUEUED");

  const res = await fetch(`${API_URL}/api/v1/notifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      type: currentType,
      payload,
    }),
  });

  const data = await res.json();

  pollStatus(data.notificationId);
}

//  Poll status
function pollStatus(id) {
  const interval = setInterval(async () => {
    const res = await fetch(`${API_URL}/api/v1/notifications/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    updateTimeline(data.status);

    if (data.status === "SENT" || data.status === "FAILED") {
      clearInterval(interval);
    }
  }, 2000);
}

//  Initial load
renderForm();