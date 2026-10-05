import fs from 'fs';
import path from 'path';
import {
  createAccountOtpTemplate,
  resetPasswordOtpTemplate,
  accountApprovedTemplate,
  subscriptionInvitationTemplate,
  invoiceTemplate,
  notificationTemplate,
} from '../src/helpers/email/templates';

const previews = [
  {
    name: 'Account Verification OTP',
    filename: 'create-account-otp.html',
    data: createAccountOtpTemplate({
      name: 'Rahim Ahmed',
      email: 'rahim.driver@example.com',
      otp: 482910,
    }),
  },
  {
    name: 'Password Reset OTP',
    filename: 'reset-password-otp.html',
    data: resetPasswordOtpTemplate({
      name: 'Rahim Ahmed',
      email: 'rahim.driver@example.com',
      otp: 719304,
    }),
  },
  {
    name: 'Account Approved',
    filename: 'account-approved.html',
    data: accountApprovedTemplate({
      name: 'Rahim Ahmed',
      email: 'rahim.driver@example.com',
      loginUrl: 'https://moeb26.com/login',
    }),
  },
  {
    name: 'Subscription Invitation',
    filename: 'subscription-invitation.html',
    data: subscriptionInvitationTemplate({
      name: 'Rahim Ahmed',
      email: 'rahim.driver@example.com',
      planName: 'Moeb26 Elite Chauffeur Plan',
      amount: 49.99,
      paymentUrl: 'https://moeb26.com/subscription/pay',
    }),
  },
  {
    name: 'Ride Invoice & Receipt',
    filename: 'invoice-receipt.html',
    data: invoiceTemplate({
      name: 'John Doe',
      email: 'john.client@example.com',
      invoiceNumber: 'INV-2026-0881',
      date: 'Aug 14, 2026',
      amount: '125.00',
      serviceType: 'Executive Black Car',
      paymentMethod: 'Visa •••• 4242',
      downloadUrl: 'https://moeb26.com/invoice/INV-2026-0881.pdf',
    }),
  },
  {
    name: 'Platform Notification',
    filename: 'notification.html',
    data: notificationTemplate({
      name: 'Rahim Ahmed',
      email: 'rahim.driver@example.com',
      title: 'New High-Value Ride Match Available',
      message: 'A VIP trip from Manhattan to JFK Airport matches your preferred service area. Check your incoming trip requests.',
      actionText: 'View Ride Request',
      actionUrl: 'https://moeb26.com/trips/req-998',
    }),
  },
];

const outputDir = path.join(__dirname, '../email-previews');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate individual HTML files
for (const item of previews) {
  const filePath = path.join(outputDir, item.filename);
  fs.writeFileSync(filePath, item.data.html, 'utf-8');
}

// Generate an Interactive Dashboard / Gallery Preview page
const galleryHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Moeb26 Email Templates Live Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0B0F17;
      color: #E2E8F0;
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    .sidebar {
      width: 320px;
      background: #111827;
      border-right: 1px solid rgba(255,255,255,0.08);
      display: flex;
      flex-direction: column;
    }
    .brand {
      padding: 24px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .brand h1 {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #F8FAFC;
    }
    .brand p {
      font-size: 12px;
      color: #64748B;
      margin-top: 4px;
    }
    .nav {
      flex: 1;
      padding: 16px 12px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .tab-btn {
      text-align: left;
      background: transparent;
      border: 1px solid transparent;
      color: #94A3B8;
      padding: 12px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .tab-btn:hover {
      background: rgba(255,255,255,0.05);
      color: #F8FAFC;
    }
    .tab-btn.active {
      background: #0284C7;
      color: #FFFFFF;
      font-weight: 600;
    }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #06090E;
    }
    .topbar {
      height: 60px;
      background: #111827;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
    }
    .subject-line {
      font-size: 14px;
      color: #94A3B8;
    }
    .subject-line strong {
      color: #F8FAFC;
    }
    .frame-container {
      flex: 1;
      padding: 24px;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #06090E;
    }
    iframe {
      width: 100%;
      max-width: 700px;
      height: 100%;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      background: #0F172A;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="brand">
      <h1>MOEB<span style="color: #38BDF8;">26</span> EMAIL PREVIEW</h1>
      <p>Interactive Email Templates Gallery</p>
    </div>
    <div class="nav" id="nav">
      ${previews
        .map(
          (p, i) => `
        <button class="tab-btn ${i === 0 ? 'active' : ''}" onclick="loadPreview('${p.filename}', '${p.data.subject}', this)">
          ${p.name}
        </button>
      `
        )
        .join('')}
    </div>
  </div>

  <div class="main">
    <div class="topbar">
      <div class="subject-line" id="subjectDisplay">
        Subject: <strong>${previews[0].data.subject}</strong>
      </div>
    </div>
    <div class="frame-container">
      <iframe id="previewFrame" src="${previews[0].filename}"></iframe>
    </div>
  </div>

  <script>
    function loadPreview(filename, subject, btn) {
      document.getElementById('previewFrame').src = filename;
      document.getElementById('subjectDisplay').innerHTML = 'Subject: <strong>' + subject + '</strong>';
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(outputDir, 'index.html'), galleryHtml, 'utf-8');
console.log('✅ Generated email preview files in:', outputDir);
