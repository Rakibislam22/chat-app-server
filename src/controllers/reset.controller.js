const SibApiV3Sdk = require("sib-api-v3-sdk");
const crypto = require("crypto");
const User = require("../models/User");

exports.sendResetEmail = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "user-not-found" });
    }

    const token = crypto.randomBytes(32).toString("hex");

    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 3600000;
    await user.save();

    // Brevo Setup
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const apiKey = defaultClient.authentications["api-key"];
    apiKey.apiKey = process.env.BREVO_API_KEY;

    const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

    await tranEmailApi.sendTransacEmail({
      sender: {
        name: "ConvoX",
        email: "your_verified_email@gmail.com",
      },
      to: [{ email }],
      subject: "Reset Your Password",
      htmlContent: `
        <h3>Password Reset</h3>
        <p>Click below:</p>
        <a href="${process.env.SITE_URL}/reset-password?token=${token}">
          Reset Password
        </a>
      `,
    });

    res.status(200).json({ message: "Reset email sent" });

  } catch (err) {
    console.error("RESET ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};