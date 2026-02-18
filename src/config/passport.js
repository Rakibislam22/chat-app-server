const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const User = require("../models/User");

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
<<<<<<< HEAD

            // Robust email extraction
            let email = null;
            if (emails && emails.length > 0) {
                email = emails[0].value || emails[0];
            }

            if (!email) {
                return done(new Error("No email found in Google profile"), null);
            }

            const avatar = photos?.[0]?.value || "";
=======
            const email = emails[0].value;
            const avatar = photos[0]?.value || "";
>>>>>>> acd97baa0b9bd401ef1be49a4711fdd4f3c2d187

            try {
                // Find user by Google ID or Email
                let user = await User.findOne({
                    $or: [{ providerId: id }, { email }]
                });

                if (user) {
                    // Update user if they exist but don't have provider info
                    if (!user.providerId) {
                        user.provider = "google";
                        user.providerId = id;
                        if (!user.avatar) user.avatar = avatar;
                        await user.save();
<<<<<<< HEAD
                        console.log(`Updated legacy user ${user.email} with Google ID`);
=======
>>>>>>> acd97baa0b9bd401ef1be49a4711fdd4f3c2d187
                    }
                    return done(null, user);
                }

                // Create new user if they don't exist
                user = new User({
<<<<<<< HEAD
                    name: displayName || "Google User",
=======
                    name: displayName,
>>>>>>> acd97baa0b9bd401ef1be49a4711fdd4f3c2d187
                    email,
                    avatar,
                    provider: "google",
                    providerId: id,
                });

                await user.save();
<<<<<<< HEAD
                console.log(`Created new Google user: ${email}`);
                done(null, user);
            } catch (err) {
                console.error("Google Auth Error:", err);
=======
                done(null, user);
            } catch (err) {
                console.error(err);
>>>>>>> acd97baa0b9bd401ef1be49a4711fdd4f3c2d187
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
            const { id, displayName, username, emails, photos } = profile;
<<<<<<< HEAD

            // Robust email extraction
            let email = null;
            if (emails && emails.length > 0) {
                email = emails[0].value || emails[0];
            }

            // Fallback if no email is found
            if (!email) {
                email = `${username || id}@github.com`;
            }

=======
            const email = emails?.[0]?.value || `${username}@github.com`; // Fallback if email is private
>>>>>>> acd97baa0b9bd401ef1be49a4711fdd4f3c2d187
            const avatar = photos?.[0]?.value || "";

            try {
                // Find user by GitHub ID or Email
                let user = await User.findOne({
                    $or: [{ providerId: id }, { email }]
                });

                if (user) {
                    // Update user if they exist but don't have provider info
                    if (!user.providerId) {
                        user.provider = "github";
                        user.providerId = id;
                        if (!user.avatar) user.avatar = avatar;
                        await user.save();
<<<<<<< HEAD
                        console.log(`Updated legacy user ${user.email} with GitHub ID`);
=======
>>>>>>> acd97baa0b9bd401ef1be49a4711fdd4f3c2d187
                    }
                    return done(null, user);
                }

                // Create new user if they don't exist
                user = new User({
<<<<<<< HEAD
                    name: displayName || username || "GitHub User",
=======
                    name: displayName || username,
>>>>>>> acd97baa0b9bd401ef1be49a4711fdd4f3c2d187
                    email,
                    avatar,
                    provider: "github",
                    providerId: id,
                });

                await user.save();
<<<<<<< HEAD
                console.log(`Created new GitHub user: ${email}`);
                done(null, user);
            } catch (err) {
                console.error("GitHub Auth Error:", err);
=======
                done(null, user);
            } catch (err) {
                console.error(err);
>>>>>>> acd97baa0b9bd401ef1be49a4711fdd4f3c2d187
                done(err, null);
            }
        }
    )
);

module.exports = passport;
