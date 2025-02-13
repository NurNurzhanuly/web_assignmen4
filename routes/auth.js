const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// Registration Route
router.get('/register', (req, res) => {
    res.render('register');
});

router.post('/register', async (req, res) => {
    const { email, password, username } = req.body;

    // Basic validation
    if (!email || !password || !username) {
        return res.render('register', { error: 'Please fill in all fields.' });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('register', { error: 'Email already registered.' });
        }

        const newUser = new User({ email, password, username });
        await newUser.save();

        console.log('New user registered:', newUser); // Debugging

        // Redirect to login after successful registration
        res.redirect('/auth/login');

    } catch (error) {
        console.error('Error registering user:', error);
        res.render('register', { error: 'An error occurred during registration.' });
    }
});

// Login Route
router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/login', async (req, res) => {
    const { email, password, token } = req.body; // Add token

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.render('login', { error: 'Invalid email.' });
        }
        if (user.lockUntil && user.lockUntil > Date.now()) {
            // Account is locked
            const timeRemaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
            return res.render('login', { error: `Account locked. Try again in ${timeRemaining} minutes.` });
        }

        const isPasswordValid = await user.isValidPassword(password);

        if (!isPasswordValid) {
             // Increment login attempts
            user.loginAttempts += 1;
            if (user.loginAttempts >= 5) {
                user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
            }
            await user.save();
            return res.render('login', { error: 'Invalid password.' });
        }

        // Reset login attempts on successful login
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        await user.save();

        // 2FA Verification
        if (user.is2FAEnabled) {
            if (!token) {
                return res.render('login', { error: 'Enter your two-factor token.', requires2FA: true, email: email });
            }

            const verified = speakeasy.totp.verify({
                secret: user.twoFASecret,
                encoding: 'base32',
                token: token,
                window: 1 // Add window to allow for slight time drifts
            });

            if (!verified) {
                return res.render('login', { error: 'Invalid two-factor token.', requires2FA: true, email: email });
            }
        }

        // Set session
        req.session.userId = user._id;
        req.session.user = {
            _id: user._id,
            email: user.email,
            username: user.username,
            is2FAEnabled: user.is2FAEnabled
        };

        console.log('User logged in:', req.session.user); // Debugging

        res.redirect('/'); // Redirect to main page

    } catch (error) {
        console.error('Error logging in:', error);
        res.render('login', { error: 'An error occurred during login.' });
    }
});

// Logout Route
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.redirect('/'); // Redirect to home page with error
        }
        res.redirect('/auth/login'); // Redirect to login after logout
    });
});


// Route to display the 2FA setup page
router.get('/setup-2fa', isLoggedIn, async (req, res) => {
    const userId = req.session.userId;
    const user = await User.findById(userId);

    if (!user) {
        return res.redirect('/auth/login');
    }

    // Check if 2FA is already enabled
    if (user.is2FAEnabled) {
        return res.redirect('/profile'); // Redirect if already enabled
    }

    // Generate a secret key using speakeasy
    const secret = speakeasy.generateSecret({ length: 20 });

    // Store the secret key in the user's session
    req.session.temp2FASecret = secret.base32;

    // Generate a QR code
    QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
        if (err) {
            console.error('Error generating QR code:', err);
            return res.redirect('/profile');
        }

        res.render('setup-2fa', { qr_code: data_url, user: user });
    });
});

// Route to enable 2FA
router.post('/enable-2fa', isLoggedIn, async (req, res) => {
    const { token } = req.body;
    const userId = req.session.userId;
    const user = await User.findById(userId);

    if (!user) {
        return res.redirect('/auth/login');
    }

    const temp2FASecret = req.session.temp2FASecret;

    // Verify the token
    const verified = speakeasy.totp.verify({
        secret: temp2FASecret,
        encoding: 'base32',
        token: token,
        window: 1 // Add window to allow for slight time drifts
    });

    if (verified) {
        // Save the secret key and enable 2FA
        user.twoFASecret = temp2FASecret;
        user.is2FAEnabled = true;
        await user.save();

        // Update the session
         req.session.user = {
             ...req.session.user,
            is2FAEnabled: true
        };


        // Clear temporary secret
        delete req.session.temp2FASecret;

        res.redirect('/profile');
    } else {
        res.render('setup-2fa', { error: 'Invalid token.' ,user: user});
    }
});

// Middleware to check if user is logged in
function isLoggedIn(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  res.redirect("/auth/login");
}


module.exports = router;