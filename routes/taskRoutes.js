// routes/taskRoutes.js
const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const {
    scheduleTask,
    getTask,
    getAllScheduledTasksByUser,
    removeTaskFromSystem,
    cancelTask
} = require('../services/taskService');

const router = express.Router();

router.post('/', authenticate, async (req, res) => {
    const { taskType, payload, scheduledTime } = req.body;
    if (!taskType || !payload || !scheduledTime) return res.status(400).json({ error: 'Missing parameters.' });
    const taskId = await scheduleTask(taskType, payload, scheduledTime, req.user.userId);
    res.status(201).json({ taskId, message: 'Task scheduled.' });
});

router.get('/', authenticate, async (req, res) => {
    const tasks = await getAllScheduledTasksByUser(req.user.userId);
    res.json(tasks);
});

router.get('/:id', authenticate, async (req, res) => {
    const task = await getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (task.userId !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });
    res.json(task);
});

router.delete('/:id', authenticate, async (req, res) => {
    const task = await getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (task.userId !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });
    await removeTaskFromSystem(req.params.id);
    res.json({ message: 'Task deleted.' });
});

router.patch('/:id/cancel', authenticate, async (req, res) => {
    const message = await cancelTask(req.params.id, req.user.userId);
    res.json({ message });
});

module.exports = router;
