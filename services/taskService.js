// services/taskService.js
const { v4: uuidv4 } = require('uuid');
const { setAsync, getAsync, delAsync, zaddAsync, zremAsync, zrangebyscoreAsync } = require('../utils/redisClient');
const { schedule } = require('node-schedule');

// Constants
const TASK_QUEUE = 'scheduled_tasks';

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

async function removeTaskFromSystem(taskId) {
    await delAsync(taskId);
    await zremAsync(TASK_QUEUE, taskId);
}

async function cancelTask(taskId, userId) {
    const task = await getTask(taskId);
    if (!task) throw new Error('Task not found.');
    if (task.userId !== userId) throw new Error('Unauthorized');
    if (task.status !== 'pending') throw new Error('Only pending tasks can be cancelled.');
    
    task.status = 'cancelled';
    await setAsync(taskId, JSON.stringify(task));
    await zremAsync(TASK_QUEUE, taskId);
    
    return 'Task cancelled successfully';
}

module.exports = {
    scheduleTask,
    getTask,
    getAllScheduledTasksByUser,
    removeTaskFromSystem,
    cancelTask
};
