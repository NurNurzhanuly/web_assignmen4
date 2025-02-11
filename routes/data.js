const express = require('express');
const router = express.Router();

// Middleware to check if user is logged in
const isLoggedIn = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/auth/login');
    }
};

router.use(isLoggedIn); // Apply middleware to all routes in this file

// Example route - replace with your actual data logic
router.get('/items', (req, res) => {
    // Fetch items from database (related to the logged-in user)
    // For example:
    // Item.find({ userId: req.session.userId })
    // .then(items => res.render('items', { items: items }))
    // .catch(err => console.error(err));
    res.send('List of items for logged-in user'); // Placeholder
});

module.exports = router;