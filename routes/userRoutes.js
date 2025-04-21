// routes/userRoutes.js
const express = require('express');
const { createUser, generateToken, getUserByUsername, isPasswordValid } = require('../services/userService');

const router = express.Router();

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
    const exists = await getUserByUsername(username);
    if (exists) return res.status(400).json({ error: 'Username already exists.' });
    const userId = await createUser(username, password);
    const token = generateToken(username, userId);
    res.status(201).json({ message: 'Registered successfully.', token });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
    const user = await getUserByUsername(username);
    if (!user || !(await isPasswordValid(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const token = generateToken(username, user.userId);
    res.json({ message: 'Login successful.', token });
});

module.exports = router;
