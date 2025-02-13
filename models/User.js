const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    username: { type: String, required: true },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    location: { type: String, default: '' },
    website: { type: String, default: '' },
    bio: { type: String, default: '' },
    profilePicture: { type: String, default: '/images/default-profile.png' },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    twoFASecret: { type: String }, // 2FA secret key
    is2FAEnabled: { type: Boolean, default: false } // Flag for 2FA activation
});

// Hash the password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        return next(error);
    }
});

// Method to compare passwords
userSchema.methods.isValidPassword = async function(password) {
    try {
        return await bcrypt.compare(password, this.password);
    } catch (error) {
        throw new Error(error);
    }
};

module.exports = mongoose.model('User', userSchema);