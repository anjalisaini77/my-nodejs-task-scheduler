// app.js
const express = require('express');
const bodyParser = require('body-parser');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const taskScheduler = require('./utils/taskScheduler'); 

const app = express();
app.use(bodyParser.json());

// Route definitions
app.use('/tasks', taskRoutes);
app.use('/user', userRoutes);

// Background task runner
taskScheduler.start();

module.exports = app;

