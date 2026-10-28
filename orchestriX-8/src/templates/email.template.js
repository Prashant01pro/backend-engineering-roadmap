// Base layout wrapping all transactional emails

const baseLayout = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 20px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .header { background-color: #1e293b; padding: 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px; }
    .content { padding: 32px 24px; color: #334155; line-height: 1.6; font-size: 15px; }
    .btn { display: inline-block; background-color: #3b82f6; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background-color: #f8fafc; padding: 16px 24px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NexusFlow OrchestriX</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} OrchestriX. All rights reserved.</p>
      <p>If you did not request this email, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>
`;


export const getVerificationEmailTemplate = ({ name, verificationUrl }) => {
    const html = baseLayout(`
      <h2>Verify Your Email Address</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>Welcome to OrchestriX. Please verify your email address to activate your account and start orchestrating workflows.</p>
      <div style="text-align: center;">
        <a href="${verificationUrl}" class="btn">Verify Email Address</a>
      </div>
      <p>Or copy and paste this URL into your browser:</p>
      <p style="word-break: break-all; color: #3b82f6;">${verificationUrl}</p>
      <p>This verification link will expire in <strong>24 hours</strong>.</p>
    `);
    const text = `Hi ${name},\n\nPlease verify your email address by opening the following link:\n${verificationUrl}\n\nThis link will expire in 24 hours.`;
    return { html, text };
};

export const getPasswordResetEmailTemplate = ({ name, resetUrl }) => {
    const html = baseLayout(`
      <h2>Password Reset Request</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>We received a request to reset your password for your NexusFlow account.</p>
      <div style="text-align: center;">
        <a href="${resetUrl}" class="btn" style="background-color: #ef4444;">Reset Password</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #ef4444;">${resetUrl}</p>
      <p>This link will expire in <strong>15 minutes</strong>.</p>
    `);
    const text = `Hi ${name},\n\nYou requested a password reset. Open the following link to reset your password:\n${resetUrl}\n\nThis link expires in 15 minutes.`;
    return { html, text };
};