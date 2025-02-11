const express = require('express');
const router = express.Router();
const Note = require('../models/Note');

// Middleware to check if user is logged in
const isLoggedIn = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/auth/login');
    }
};

router.use(isLoggedIn); // Apply middleware to all routes in this file

// Route to get all notes for the logged-in user
router.get('/notes', async (req, res) => {
    try {
        const notes = await Note.find({ userId: req.session.userId });
        res.json(notes); // Send notes as JSON
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});

// Route to create a new note
router.post('/notes', async (req, res) => {
    try {
        const { title, content } = req.body;
        const newNote = new Note({
            title,
            content,
            userId: req.session.userId // Associate the note with the logged-in user
        });
        await newNote.save();
        res.status(201).json(newNote); // Send the newly created note as JSON
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({ error: 'Failed to create note' });
    }
});

module.exports = router;