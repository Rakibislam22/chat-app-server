const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const User = require("../models/User");
const { linkSocialAccountToExisting } = require("../services/accountMerge.service");

// Google Strategy
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "/auth/google/callback",
            proxy: true,
        },
        async (accessToken, refreshToken, profile, done) => {
            const { id, displayName, emails, photos } = profile;

            // Robust email extraction
            let email = null;
            if (emails && emails.length > 0) {
                email = emails[0].value || emails[0];
            }

            if (!email) {
                return done(new Error("No email found in Google profile"), null);
            }

            let avatar = photos?.[0]?.value || "";
            if (avatar) avatar = avatar.replace(/=s\d+[^"']*/g, "");

            try {
                // Use account merge service to link/create user
                const result = await linkSocialAccountToExisting(
                    email,
                    "google",
                    id,
                    { name: displayName, avatar, username: displayName }
                );

                // Attach merge info to user for OAuth callback to use
                result.user._doc = result.user._doc || {};
                result.user._doc.justMerged = result.merged;
                result.user._doc.mergeMessage = result.message;

                done(null, result.user);
            } catch (err) {
                console.error("Google Auth Error:", err);
                done(err, null);
            }
        }
    )
);

// GitHub Strategy
passport.use(
    new GitHubStrategy(
        {
            clientID: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            callbackURL: "/auth/github/callback",
            proxy: true,
        },
        async (accessToken, refreshToken, profile, done) => {
            let { id, displayName, username, emails, photos } = profile;

            // Robust email extraction
            let email = null;
            if (emails && emails.length > 0) {
                email = emails[0].value || emails[0];
            }

            // If no email in profile (happens with private emails), fetch from GitHub API
            if (!email && accessToken) {
                try {
                    const response = await fetch("https://api.github.com/user/emails", {
                        headers: {
                            Authorization: `token ${accessToken}`,
                            "User-Agent": "ConvoX-Server",
                        },
                    });
                    const fetchedEmails = await response.json();

                    if (Array.isArray(fetchedEmails)) {
                        // Find primary email, otherwise just first one
                        const primaryEmail = fetchedEmails.find(e => e.primary && e.verified) ||
                            fetchedEmails.find(e => e.verified) ||
                            fetchedEmails[0];

                        if (primaryEmail) {
                            email = primaryEmail.email;
                            console.log(`Fetched private email for ${username}: ${email}`);
                        }
                    }
                } catch (fetchErr) {
                    console.error("Error fetching GitHub emails:", fetchErr);
                }
            }

            // Final fallback if still no email found
            if (!email) {
                email = `${username || id}@github.com`;
                console.warn(`Could not fetch real email for ${username}, using fallback: ${email}`);
            }

            // GitHub avatar URLs can include size query params — strip for canonical URL.
            let avatar = photos?.[0]?.value || "";
            if (avatar) avatar = avatar.replace(/[?&]v=\d+/g, "").replace(/&s=\d+/g, "");

            try {
                // Use account merge service to link/create user
                const result = await linkSocialAccountToExisting(
                    email,
                    "github",
                    id,
                    { name: displayName || username || "GitHub User", avatar, username }
                );

                // Attach merge info to user for OAuth callback to use
                result.user._doc = result.user._doc || {};
                result.user._doc.justMerged = result.merged;
                result.user._doc.mergeMessage = result.message;

                done(null, result.user);
            } catch (err) {
                console.error("GitHub Auth Error:", err);
                done(err, null);
            }
        }
    )
);

module.exports = passport;
