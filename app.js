// app.js
const express = require('express');
const bodyParser = require('body-parser');
const redis = require('redis');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const schedule = require('node-schedule');

const app = express();
app.use(bodyParser.json());

// ===============================
// Configuration
// ===============================
const config = {
    redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: '1h',
    },
    bcrypt: {
        saltRounds: 10,
    },
};

// ===============================
// Redis Setup
// ===============================
const redisClient = redis.createClient(config.redis);

const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);
const delAsync = promisify(redisClient.del).bind(redisClient);
const zaddAsync = promisify(redisClient.zadd).bind(redisClient);
const zrangebyscoreAsync = promisify(redisClient.zrangebyscore).bind(redisClient);
const zremAsync = promisify(redisClient.zrem).bind(redisClient);

redisClient.on('connect', () => console.log('Connected to Redis'));
redisClient.on('error', (err) => console.error('Redis connection error:', err));

// ===============================
// Constants
// ===============================
const TASK_QUEUE = 'scheduled_tasks';
const USER_KEY_PREFIX = 'user:';

// ===============================
// Utility Functions - Task
// ===============================
async function scheduleTask(taskType, payload, scheduledTime, userId) {
    const taskId = uuidv4();
    const task = { taskId, taskType, payload, status: 'pending', scheduledTime, userId };
    await setAsync(taskId, JSON.stringify(task));
    await zaddAsync(TASK_QUEUE, scheduledTime, taskId);
    return taskId;
}

async function getTask(taskId) {
    const data = await getAsync(taskId);
    return data ? JSON.parse(data) : null;
}

async function setTaskStatus(taskId, status) {
    const task = await getTask(taskId);
    if (task) {
        task.status = status;
        await setAsync(taskId, JSON.stringify(task));
    }
}

async function removeTaskFromSystem(taskId) {
    await delAsync(taskId);
    await zremAsync(TASK_QUEUE, taskId);
}

async function getAllScheduledTasksByUser(userId) {
    const taskIds = await zrangebyscoreAsync(TASK_QUEUE, '-inf', '+inf');
    const tasks = [];
    for (const id of taskIds) {
        const data = await getAsync(id);
        if (data) {
            const task = JSON.parse(data);
            if (!userId || task.userId === userId) tasks.push(task);
        }
    }
    return tasks;
}

// ===============================
// Utility Functions - Auth
// ===============================
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
    await setAsync(USER_KEY_PREFIX + username, JSON.stringify(user));
    return userId;
}

async function getUserByUsername(username) {
    const data = await getAsync(USER_KEY_PREFIX + username);
    return data ? JSON.parse(data) : null;
}

function generateToken(username, userId) {
    return jwt.sign({ username, userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

// ===============================
// Middleware
// ===============================
const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    try {
        const decoded = jwt.verify(token, config.jwt.secret);
        const user = await getUserByUsername(decoded.username);
        if (!user) return res.status(401).json({ error: 'Invalid token.' });
        req.user = { username: decoded.username, userId: decoded.userId };
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid token.' });
    }
};

// ===============================
// API Routes
// ===============================
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
    const exists = await getUserByUsername(username);
    if (exists) return res.status(400).json({ error: 'Username already exists.' });
    const userId = await createUser(username, password);
    const token = generateToken(username, userId);
    res.status(201).json({ message: 'Registered successfully.', token });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
    const user = await getUserByUsername(username);
    if (!user || !(await isPasswordValid(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const token = generateToken(username, user.userId);
    res.json({ message: 'Login successful.', token });
});

app.post('/tasks', authenticate, async (req, res) => {
    const { taskType, payload, scheduledTime } = req.body;
    if (!taskType || !payload || !scheduledTime) return res.status(400).json({ error: 'Missing parameters.' });
    const taskId = await scheduleTask(taskType, payload, scheduledTime, req.user.userId);
    res.status(201).json({ taskId, message: 'Task scheduled.' });
});

app.get('/tasks', authenticate, async (req, res) => {
    const tasks = await getAllScheduledTasksByUser(req.user.userId);
    res.json(tasks);
});

app.get('/tasks/:id', authenticate, async (req, res) => {
    const task = await getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (task.userId !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });
    res.json(task);
});

app.delete('/tasks/:id', authenticate, async (req, res) => {
    const task = await getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (task.userId !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });
    await removeTaskFromSystem(req.params.id);
    res.json({ message: 'Task deleted.' });
});


 * Cancel a scheduled task
 * PATCH /tasks/:id/cancel
 
app.patch('/tasks/:id/cancel', authenticate, async (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.user.userId;

        const task = await getTask(taskId);
        if (!task) return res.status(404).json({ error: 'Task not found.' });
        if (task.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });

        // Only allow cancellation if it's still pending
        if (task.status !== 'pending') {
            return res.status(400).json({ error: 'Only pending tasks can be cancelled.' });
        }

        task.status = 'cancelled';
        await setAsync(taskId, JSON.stringify(task));
        await zremAsync(TASK_QUEUE, taskId);

        res.json({ message: 'Task cancelled successfully.' });
    } catch (error) {
        console.error('Error cancelling task:', error);
        res.status(500).json({ error: 'Failed to cancel task.' });
    }
});



/**
 * Schedules all pending tasks from Redis using node-schedule
 */
async function schedulePendingTasks() {
    try {
        const taskIds = await zrangebyscoreAsync(TASK_QUEUE, '-inf', '+inf');
        for (const taskId of taskIds) {
            const taskData = await getAsync(taskId);
            if (taskData) {
                const task = JSON.parse(taskData);
                const scheduledDate = new Date(task.scheduledTime * 1000);

                if (scheduledDate > new Date()) {
                    schedule.scheduleJob(taskId, scheduledDate, async () => {
                        console.log(`Executing task ${task.taskId}`);

                        switch (task.taskType) {
                            case 'email':
                                console.log('Sending email:', task.payload);
                                break;
                            case 'log':
                                console.log('Log:', task.payload.message);
                                break;
                            default:
                                console.log('Unknown task type:', task.taskType);
                        }

                        await updateTaskStatus(task.taskId, 'completed');
                        await deleteTask(task.taskId);
                    });
                }
            }
        }
    } catch (err) {
        console.error('Error while scheduling tasks:', err);
    }
}




// ===============================
// Background Task Runner
// ===============================
async function processTasks() {
    while (true) {
        try {
            const now = Math.floor(Date.now() / 1000);
            const taskIds = await zrangebyscoreAsync(TASK_QUEUE, '-inf', now);
            for (const id of taskIds) {
                const data = await getAsync(id);
                if (data) {
                    const task = JSON.parse(data);
                    console.log(`Executing task ${task.taskId} (${task.taskType})`);
                    if (task.taskType === 'email') {
                        console.log('Send email:', task.payload);
                    } else if (task.taskType === 'log') {
                        console.log('Log message:', task.payload.message);
                    } else {
                        console.log('Unknown task type');
                    }
                    await setTaskStatus(id, 'completed');
                    await removeTaskFromSystem(id);
                }
            }
        } catch (e) {
            console.error('Background task error:', e);
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
}

processTasks();

module.exports = app;
