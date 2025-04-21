// services/userService.js
const { setAsync, getAsync } = require('../utils/redisClient');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Config
const config = {
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: '1h',
    },
    bcrypt: {
        saltRounds: 10,
    },
};

async function hashPassword(password) {
    return bcrypt.hash(password, config.bcrypt.saltRounds);
}

async function isPasswordValid(password, hash) {
    return bcrypt.compare(password, hash);
}

async function createUser(username, password) {
    const userId = uuidv4();
    const hashed = await hashPassword(password);
    const user = { userId, username, password: hashed };
    await setAsync('user:' + username, JSON.stringify(user));
    return userId;
}

async function getUserByUsername(username) {
    const data = await getAsync('user:' + username);
    return data ? JSON.parse(data) : null;
}

function generateToken(username, userId) {
    return jwt.sign({ username, userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

module.exports = {
    createUser,
    generateToken,
    getUserByUsername,
    isPasswordValid
};
