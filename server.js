require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const path = require('path');
const Note = require('./models/Note'); // Import the Note model

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
        res.render('profile', { user: req.session.user, notes: notes }); // Pass notes to the view
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.render('profile', { user: req.session.user, notes: [], error: 'Failed to fetch notes.' }); // Handle error
    }
});

app.get('/', (req, res) => {
    res.redirect('/auth/login');
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});