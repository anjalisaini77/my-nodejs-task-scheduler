// utils/taskScheduler.js
const { zrangebyscoreAsync, getAsync } = require('./redisClient');
const { schedule } = require('node-schedule');
const { setTaskStatus, removeTaskFromSystem } = require('../services/taskService');

async function schedulePendingTasks() {
    try {
        const taskIds = await zrangebyscoreAsync('scheduled_tasks', '-inf', '+inf');
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

                        await setTaskStatus(task.taskId
