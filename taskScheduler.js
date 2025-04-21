const cron = require('node-schedule');

// Example of scheduling a task to log a message every minute
const scheduleReminderTask = () => {
  cron.scheduleJob('* * * * *', function(){
    console.log('Reminder: Task executed!');
  });
};

scheduleReminderTask();
