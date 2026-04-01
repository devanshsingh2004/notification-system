const API_URL = window.location.origin;

let token = "";
let currentType = "EMAIL";

function selectTab(type) {
  currentType = type;
  renderForm();
}

// FORM 
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

// LOGIN 
async function login() {
  if (token) return;

  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", 
    body: JSON.stringify({ email: "test@gmail.com" }),
  });

  const data = await res.json();
  token = data.accessToken;
}

//  REFRESH 
async function refreshToken() {
  console.log(" Refreshing token...");

  const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include", 
  });

  if (!res.ok) {
    throw new Error("Refresh failed");
  }

  const data = await res.json();
  token = data.accessToken;

  console.log(" Token refreshed");
}

//  FETCH WRAPPER (CORE LOGIC) 
async function fetchWithAuth(url, options = {}, retry = true) {
  options.headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  options.credentials = "include";

  let res = await fetch(url, options);

  //  If access token expired
  if (res.status === 401 && retry) {
    try {
      await refreshToken();

      // retry original request once
      return fetchWithAuth(url, options, false);
    } catch (err) {
      console.log(" Session expired, re-login");

      token = "";
      await login();

      return fetchWithAuth(url, options, false);
    }
  }

  return res;
}

//  TIMELINE 
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

//  SEND 
async function sendNotification() {
  await login();

  let payload = {};

  if (currentType === "EMAIL") {
    payload = {
      to: document.getElementById("email").value,
      subject: document.getElementById("subject").value,
      text: document.getElementById("message").value,
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

  updateTimeline("QUEUED");

  const res = await fetchWithAuth(`${API_URL}/api/v1/notifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      type: currentType,
      payload,
    }),
  });

  const data = await res.json();

  if (!data.notificationId) {
    console.error(" No notificationId:", data);
    alert("Error sending notification");
    return;
  }

  console.log("Notification ID:", data.notificationId);

  pollStatus(data.notificationId);
}

//POLL
function pollStatus(id) {
  const interval = setInterval(async () => {
    const res = await fetchWithAuth(
      `${API_URL}/api/v1/notifications/${id}`
    );

    const data = await res.json();

    console.log("Status:", data.status);

    updateTimeline(data.status);

    if (data.status === "SENT" || data.status === "FAILED") {
      clearInterval(interval);
    }
  }, 2000);
}

// INIT 
renderForm();
