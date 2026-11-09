import crypto from "node:crypto";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  },
  body: JSON.stringify(body)
});

const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const base64url = (value) => Buffer.from(value).toString("base64url");
const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);

function requiredConfiguration() {
  const keys = [
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_PRIVATE_KEY",
    "GOOGLE_SHEET_ID",
    "GOOGLE_SHEET_RANGE",
    "ZOHO_CPAAS_API_KEY",
    "ZOHO_CPAAS_FROM_ADDRESS",
    "WHATSAPP_COMMUNITY_INVITE_URL"
  ];
  return keys.filter((key) => !process.env[key]);
}

async function googleAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claim}`;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).end().sign(privateKey).toString("base64url");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` })
  });
  if (!response.ok) throw new Error(`Google authentication failed (${response.status})`);
  return (await response.json()).access_token;
}

async function appendRegistration(token, values) {
  const sheetId = encodeURIComponent(process.env.GOOGLE_SHEET_ID);
  const range = encodeURIComponent(process.env.GOOGLE_SHEET_RANGE);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ majorDimension: "ROWS", values: [values] })
  });
  if (!response.ok) throw new Error(`Google Sheets write failed (${response.status})`);
  return response.json();
}

async function updateInviteStatus(token, updatedRange, status) {
  const row = updatedRange?.match(/!A(\d+):/i)?.[1];
  const sheetName = process.env.GOOGLE_SHEET_RANGE.split("!")[0];
  if (!row || !sheetName) return;
  const range = encodeURIComponent(`${sheetName}!N${row}`);
  const sheetId = encodeURIComponent(process.env.GOOGLE_SHEET_ID);
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=RAW`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ range: `${sheetName}!N${row}`, majorDimension: "ROWS", values: [[status]] })
  });
}

async function sendInvite({ email, fullName }) {
  const inviteUrl = process.env.WHATSAPP_COMMUNITY_INVITE_URL;
  const firstName = clean(fullName, 120).split(/\s+/)[0] || "there";
  const fromName = process.env.ZOHO_CPAAS_FROM_NAME || "Sonic Tonic Collective";
  const endpoint = process.env.ZOHO_CPAAS_API_URL || "https://cpaas.zoho.com/v1.1/email";
  const subject = "Welcome to the STC community";
  const htmlbody = `
    <div style="background:#080808;color:#f4f2ed;font-family:Arial,sans-serif;padding:32px;line-height:1.6">
      <div style="max-width:600px;margin:0 auto">
        <p>Hi ${escapeHtml(firstName)},</p>
        <p>Thanks for becoming part of Sonic Tonic Collective.</p>
        <p>Use the private link below to join the STC WhatsApp community. Please do not share it publicly.</p>
        <p style="margin:28px 0"><a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#f4f2ed;color:#080808;padding:14px 18px;text-decoration:none;font-weight:bold">JOIN THE STC COMMUNITY</a></p>
        <p>New Open Decks registration rounds are announced inside the community.</p>
        <p>See you inside,<br>Sonic Tonic Collective</p>
      </div>
    </div>`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Zoho-enczapikey ${process.env.ZOHO_CPAAS_API_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      from: { address: process.env.ZOHO_CPAAS_FROM_ADDRESS, name: fromName },
      to: [{ email_address: { address: email, name: fullName } }],
      subject,
      htmlbody
    })
  });
  if (!response.ok) throw new Error(`Zoho CPaaS send failed (${response.status})`);
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: { Allow: "POST, OPTIONS" }, body: "" };
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed." });
  if (Number(event.headers["content-length"] || 0) > 32_000) return json(413, { message: "Submission is too large." });

  const missing = requiredConfiguration();
  if (missing.length) return json(503, { message: "Registration is not connected in this preview yet." });

  let data;
  try { data = JSON.parse(event.body || "{}"); }
  catch { return json(400, { message: "Invalid submission." }); }

  if (clean(data.website, 100)) return json(200, { ok: true });

  const fullName = clean(data.full_name, 120);
  const email = clean(data.email, 200).toLowerCase();
  const connection = clean(data.connection, 120);
  const membershipConsent = data.membership_consent === true;
  if (!fullName || !connection || !membershipConsent || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { message: "Complete all required fields and confirm the membership consent." });
  }

  const submittedAt = new Date().toISOString();
  const registrationId = crypto.randomUUID();
  const environment = process.env.APP_ENV || process.env.CONTEXT || "unknown";
  const values = [
    submittedAt,
    registrationId,
    environment,
    fullName,
    email,
    clean(data.artist_name, 120),
    clean(data.location, 120),
    connection,
    clean(data.links, 500),
    clean(data.about, 1200),
    "yes",
    data.email_updates === true ? "yes" : "no",
    clean(data.consent_version, 80),
    "pending",
    clean(event.headers.referer || "website", 500),
    clean(event.headers["user-agent"], 500)
  ];

  try {
    const token = await googleAccessToken();
    const writeResult = await appendRegistration(token, values);
    try {
      await sendInvite({ email, fullName });
      await updateInviteStatus(token, writeResult.updates?.updatedRange, "sent");
      return json(200, { ok: true });
    } catch (mailError) {
      console.error(mailError);
      await updateInviteStatus(token, writeResult.updates?.updatedRange, "failed");
      return json(202, { ok: true, warning: "Registration saved; invite email requires follow-up." });
    }
  } catch (error) {
    console.error(error);
    return json(500, { message: "We could not save your registration. Please try again later." });
  }
}
