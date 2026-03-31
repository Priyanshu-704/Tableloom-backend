const { logger } = require("./logger.js");
const nodemailer = require("nodemailer");
require("dotenv").config({ quiet: true });

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

const sendStaffCredentials = async (email, name, password, role) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Your Staff Account Credentials - QR Order System",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to QR Order System!</h2>
        <p>Hello ${name},</p>
        <p>Your staff account has been created with the following details:</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> <code style="background: #e0e0e0; padding: 5px 10px; border-radius: 3px;">${password}</code></p>
          <p><strong>Role:</strong> ${role}</p>
        </div>
        
        <p><strong>Important Security Notice:</strong></p>
        <ul>
          <li>This is a temporary password</li>
          <li>Please login and change your password immediately</li>
          <li>Keep your credentials secure and do not share them</li>
        </ul>
        
        <p>You can access the system at: ${process.env.FRONTEND_URL}</p>
        
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

module.exports = {
  sendStaffCredentials,
  sendPasswordResetEmail,
};
