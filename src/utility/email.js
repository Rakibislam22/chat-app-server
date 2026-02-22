const { BrevoClient } = require("@getbrevo/brevo");

/**
 * Sends an OTP validation code to the given user email using Brevo.
 *
 * @param {string} to_email - The email address to send the OTP to.
 * @param {string} to_name - The name of the user receiving the code.
 * @param {string} otp_code - The 6-digit OTP code to send.
 */
const sendOTP = async (to_email, to_name, otp_code) => {
  try {
    const brevo = new BrevoClient({
      apiKey: process.env.BREVO_API_KEY,
    });

    const data = await brevo.transactionalEmails.sendTransacEmail({
      subject: "Your Verification Code - ConvoX",
      htmlContent: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Welcome to ConvoX, ${to_name}!</h2>
        <p>Your verification code is: <strong style="font-size: 24px; color: #13c8ec;">${otp_code}</strong></p>
        <p>This code will expire in 10 minutes. Please enter it on the verification page to complete your registration.</p>
        <p>If you did not request this code, please ignore this email.</p>
      </div>
    `,
      sender: { name: "ConvoX", email: "rezaulrahaat@gmail.com" },
      to: [{ email: to_email, name: to_name }],
    });

    console.log("OTP email sent successfully via Brevo.");
    return data;
  } catch (error) {
    console.error("Error sending OTP email via Brevo:", error);
    throw new Error("Failed to send OTP email.");
  }
};

module.exports = { sendOTP };
