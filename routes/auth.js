const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');

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
    const { email, password } = req.body;

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

        // Set session
        req.session.userId = user._id;
        req.session.user = {
            _id: user._id,
            email: user.email,
            username: user.username,
            // Add other user info you want to store in the session
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

module.exports = router;