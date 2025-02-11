require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const path = require('path');
const Note = require('./models/Note');
const User = require('./models/User');
const { body, validationResult } = require('express-validator'); // Import express-validator

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 14 * 24 * 60 * 60,
        autoRemove: 'native'
    })
}));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.error('MongoDB connection error:', err));

// Middleware to check if user is logged in
const isLoggedIn = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/auth/login');
    }
};

// Routes
app.use('/auth', authRoutes);
app.use('/data', dataRoutes);

// Protected route example
app.get('/profile', isLoggedIn, async (req, res) => {
    try {
        const notes = await Note.find({ userId: req.session.userId }); // Fetch notes
        const user = await User.findById(req.session.userId).lean(); // Get user data

        const editMode = req.query.edit === 'true';
        
        res.render('profile', { 
            user: user, 
            notes: notes, 
            editing: editMode,
            errors: [] // Initialize errors array
         });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.render('profile', { user: req.session.user, notes: [], error: 'Failed to fetch notes.', editing: false, errors: [] }); // Handle error
    }
});

app.post('/profile/edit', isLoggedIn, [
    body('username').trim().isLength({ min: 3, max: 20 }).withMessage('Username must be between 3 and 20 characters'),
    body('firstName').trim().isLength({ max: 50 }).withMessage('First name cannot be longer than 50 characters'),
    body('lastName').trim().isLength({ max: 50 }).withMessage('Last name cannot be longer than 50 characters'),
    body('location').trim().isLength({ max: 50 }).withMessage('Location cannot be longer than 50 characters'),
    body('website').trim().isURL().withMessage('Website must be a valid URL').optional({ nullable: true, checkFalsy: true }),
    body('bio').trim().isLength({ max: 200 }).withMessage('Bio cannot be longer than 200 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // If there are validation errors, re-render the profile page with the errors
            const notes = await Note.find({ userId: req.session.userId }); // Fetch notes
            const user = await User.findById(req.session.userId).lean()
            return res.render('profile', { 
                user: user, 
                notes: notes, 
                editing: true, 
                errors: errors.array() // Pass the errors to the view
            });
        }

        const { username, firstName, lastName, location, website, bio } = req.body;
        const userId = req.session.userId;

        // Find the user
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Update the user's information
        user.username = username;
        user.firstName = firstName;
        user.lastName = lastName;
        user.location = location;
        user.website = website;
        user.bio = bio;

        // Save the updated user
        await user.save();

        // Update the session as well
        req.session.user = {
            _id: user._id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            location: user.location,
            website: user.website,
            bio: user.bio,
        };

        // Redirect back to the profile page
        res.redirect('/profile');

    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).send('An error occurred while updating the profile.');
    }
});

app.get('/', (req, res) => {
    if (req.session.userId) {
        // User is logged in, render the main page
        res.render('main', { user: req.session.user });
    } else {
        // User is not logged in, render the index page
        res.render('index');
    }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});