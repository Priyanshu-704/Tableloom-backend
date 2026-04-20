const { logger } = require("./logger.js");
const nodemailer = require("nodemailer");
require("dotenv").config({
  quiet: true,
});
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});
const normalizeBaseUrl = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");
const buildTenantAdminLoginUrl = (tenant = {}) => {
  const baseUrl = normalizeBaseUrl(process.env.FRONTEND_URL);
  const tenantSlug = String(tenant?.slug || "")
    .trim()
    .toLowerCase();
  const tenantKey = String(tenant?.key || "")
    .trim()
    .toLowerCase();
  if (!baseUrl || !tenantSlug || !tenantKey) {
    return baseUrl || null;
  }
  return `${baseUrl}/${tenantSlug}/${tenantKey}/admin/login`;
};
const buildTenantAdminResetUrl = (tenant = {}, resetToken = "") => {
  const baseUrl = normalizeBaseUrl(process.env.FRONTEND_URL);
  const normalizedResetToken = String(resetToken || "").trim();
  if (!baseUrl || !normalizedResetToken) {
    return null;
  }

  const tenantSlug = String(tenant?.slug || "")
    .trim()
    .toLowerCase();
  const tenantKey = String(tenant?.key || "")
    .trim()
    .toLowerCase();

  if (!tenantSlug || !tenantKey) {
    return `${baseUrl}/admin/reset-password/${normalizedResetToken}`;
  }

  return `${baseUrl}/${tenantSlug}/${tenantKey}/admin/reset-password/${normalizedResetToken}`;
};
const sendStaffCredentials = async (
  email,
  name,
  password,
  role,
  options = {},
) => {
  const loginUrl = String(
    options?.loginUrl || process.env.FRONTEND_URL || "",
  ).trim();
  const subject = String(
    options?.subject || "Your Staff Account Credentials - QR Order System",
  ).trim();
  const heading = String(
    options?.heading || "Welcome to QR Order System!",
  ).trim();
  const intro = String(
    options?.intro ||
      "Your staff account has been created with the following details:",
  ).trim();
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${heading}</h2>
        <p>Hello ${name},</p>
        <p>${intro}</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> <code style="background: #e0e0e0; padding: 5px 10px; border-radius: 3px;">${password}</code></p>
          <p><strong>Role:</strong> ${role}</p>
          ${loginUrl ? `<p><strong>Admin Panel URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>` : ""}
        </div>
        
        <p><strong>Important Security Notice:</strong></p>
        <ul>
          <li>This is a temporary password</li>
          <li>Please login and change your password immediately</li>
          <li>Keep your credentials secure and do not share them</li>
        </ul>
        
        ${loginUrl ? `<p>You can access the system at: <a href="${loginUrl}">${loginUrl}</a></p>` : ""}
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px;">
            If you did not expect this email, please contact your manager immediately.
          </p>
        </div>
      </div>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Credentials email sent to ${email}`);
    return true;
  } catch (error) {
    logger.error("Email sending failed:", error);
    return false;
  }
};
const sendStaffOnboardingEmail = async ({
  email,
  name,
  role,
  resetToken,
  tenant = null,
  subject = "Set Up Your Staff Account - QR Order System",
  heading = "Your account is ready",
  intro = "Your staff account has been created. Set your password securely using the link below:",
} = {}) => {
  const resetUrl = buildTenantAdminResetUrl(tenant, resetToken);
  const loginUrl =
    buildTenantAdminLoginUrl(tenant) || normalizeBaseUrl(process.env.FRONTEND_URL);
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${heading}</h2>
        <p>Hello ${name},</p>
        <p>${intro}</p>

        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Role:</strong> ${role}</p>
          ${loginUrl ? `<p><strong>Admin Panel URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>` : ""}
        </div>

        ${
          resetUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}"
             style="background: #007bff; color: white; padding: 12px 24px;
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Set Your Password
          </a>
        </div>
        <p>This secure setup link expires in 10 minutes.</p>
        `
            : "<p>Please contact your administrator to complete password setup.</p>"
        }

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px;">
            If you did not expect this email, please contact your manager immediately.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Onboarding email sent to ${email}`);
    return true;
  } catch (error) {
    logger.error("Onboarding email sending failed:", error);
    return false;
  }
};
const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/admin/reset-password/${resetToken}`;
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Password Reset Request - QR Order System",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>You requested a password reset for your QR Order System account.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background: #007bff; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Your Password
          </a>
        </div>
        
        <p>This reset link will expire in 10 minutes.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px;">
            If you didn't request this reset, please ignore this email.
          </p>
        </div>
      </div>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    logger.error("Password reset email failed:", error);
    return false;
  }
};
const sendTenantRejectionEmail = async ({
  tenant,
  adminName,
  adminEmail,
  reason = "",
} = {}) => {
  const supportUrl = normalizeBaseUrl(process.env.FRONTEND_URL);
  const normalizedReason = String(reason || "").trim();
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: adminEmail,
    subject: `Tenant Registration Update - ${tenant?.name || "Your workspace"}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Tenant registration was not approved</h2>
        <p>Hello ${adminName || tenant?.requestedAdmin?.name || tenant?.name || "there"},</p>
        <p>We reviewed the registration request for <strong>${tenant?.name || "your restaurant workspace"}</strong>, and it was not approved at this time.</p>

        <div style="background: #fdf2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #fecaca;">
          <p><strong>Restaurant:</strong> ${tenant?.name || "-"}</p>
          <p><strong>Requested admin email:</strong> ${adminEmail || tenant?.requestedAdmin?.email || tenant?.contact?.email || "-"}</p>
          ${normalizedReason ? `<p><strong>Reason:</strong> ${normalizedReason}</p>` : ""}
        </div>

        <p>If you think this needs another review, please contact the platform support team${supportUrl ? ` from ${supportUrl}` : ""}.</p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px;">
            This message was sent automatically by QR Order System.
          </p>
        </div>
      </div>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Tenant rejection email sent to ${adminEmail}`);
    return true;
  } catch (error) {
    logger.error("Tenant rejection email failed:", error);
    return false;
  }
};
module.exports = {
  sendStaffCredentials,
  sendStaffOnboardingEmail,
  sendPasswordResetEmail,
  sendTenantRejectionEmail,
  buildTenantAdminLoginUrl,
  buildTenantAdminResetUrl,
};
