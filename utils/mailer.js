const nodemailer = require('nodemailer');

/**
 * Sends a registration OTP to the specified email address.
 * Gracefully falls back to console logging if SMTP environment variables are not configured.
 * 
 * @param {string} email 
 * @param {string} otp 
 * @returns {Promise<{ sent: boolean, method: 'smtp' | 'console', info?: any }>}
 */
async function sendRegistrationOtp(email, otp) {
  const host = process.env.SMTP_HOST ? process.env.SMTP_HOST.trim().replace(/^['"]|['"]$/g, '') : undefined;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT.toString().trim().replace(/^['"]|['"]$/g, '')) : 587;
  const user = process.env.SMTP_USER ? process.env.SMTP_USER.trim().replace(/^['"]|['"]$/g, '') : undefined;
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim().replace(/^['"]|['"]$/g, '') : undefined;
  const from = process.env.SMTP_FROM ? process.env.SMTP_FROM.trim().replace(/^['"]|['"]$/g, '') : (user || 'noreply@medicore.com');

  const isSmtpConfigured = !!(host && user && pass);

  console.log(`\n======================================================`);
  console.log(`🔑 [MediCore OTP] Sending OTP to: ${email}`);
  console.log(`👉 OTP Code: [ ${otp} ]`);
  console.log(`⏳ Expiration: 15 Minutes`);
  console.log(`======================================================\n`);

  if (!isSmtpConfigured) {
    console.log(`⚠️  [SMTP Mailer] SMTP environment variables are not fully configured.`);
    console.log(`ℹ️  Please add SMTP_HOST, SMTP_USER, and SMTP_PASS to your .env to send real emails.`);
    return { sent: true, method: 'console' };
  }

  try {
    const transportConfig = {
      auth: {
        user,
        pass,
      }
    };

    if (host.toLowerCase().includes('gmail.com')) {
      transportConfig.service = 'gmail';
    } else {
      transportConfig.host = host;
      transportConfig.port = parseInt(port);
      transportConfig.secure = parseInt(port) === 465;
      transportConfig.tls = {
        rejectUnauthorized: false
      };
      transportConfig.connectionTimeout = 10000;
      transportConfig.socketTimeout = 15000;
    }

    const transporter = nodemailer.createTransport(transportConfig);

    const mailOptions = {
      from: `"MediCore Healthcare" <${from}>`,
      to: email,
      subject: 'MediCore Account Verification OTP',
      text: `Hello,\n\nThank you for choosing MediCore Healthcare! Your verification OTP code is: ${otp}.\n\nThis code is valid for 15 minutes. Please do not share this OTP with anyone.\n\nWarm regards,\nThe MediCore Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-b: 2px solid #3b82f6;">
            <h1 style="color: #1e3a8a; margin: 0; font-size: 24px;">MediCore Healthcare</h1>
            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Smart Healthcare Management</p>
          </div>
          <p style="color: #334155; font-size: 16px; line-height: 1.5;">Hello,</p>
          <p style="color: #334155; font-size: 16px; line-height: 1.5;">Thank you for registering an account with MediCore! To complete your registration and verify your email address, please use the 6-digit verification code below:</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2563eb; background-color: #eff6ff; padding: 12px 32px; border-radius: 8px; border: 1px dashed #3b82f6;">
              ${otp}
            </span>
          </div>

          <p style="color: #ef4444; font-size: 14px; font-weight: 500; margin-bottom: 24px;">
            ⚠️ This code is valid for exactly 15 minutes and can only be used once. Please keep this code secure.
          </p>

          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          
          <p style="color: #64748b; font-size: 12px; line-height: 1.5; text-align: center;">
            If you did not initiate this request, you can safely ignore this email. Someone may have entered your email address by mistake.<br />
            &copy; 2026 MediCore Healthcare Systems. All rights reserved.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️  [SMTP Mailer] Real email dispatched successfully via ${host}. MessageId: ${info.messageId}`);
    return { sent: true, method: 'smtp', info };
  } catch (error) {
    console.error(`❌ [SMTP Mailer] Failed to send real email via SMTP:`, error.message);
    console.log(`ℹ️  Falling back to terminal console OTP display...`);
    return { sent: false, method: 'console', error: error.message };
  }
}

module.exports = { sendRegistrationOtp };
