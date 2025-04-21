// utils/redisClient.js
const redis = require('redis');
const { promisify } = require('util');

const config = {
    redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
    },
};

const redisClient = redis.createClient(config.redis);

const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);
const delAsync = promisify(redisClient.del).bind(redisClient);
const zaddAsync = promisify(redisClient.zadd).bind(redisClient);
const zrangebyscoreAsync = promisify(redisClient.zrangebyscore).bind(redisClient);
const zremAsync = promisify(redisClient.zrem).bind(redisClient);

redisClient.on('connect', () => console.log('Connected to Redis'));
redisClient.on('error', (err) => console.error('Redis connection error:', err));

module.exports = {
    getAsync,
    setAsync,
    delAsync,
    zaddAsync,
    zrangebyscoreAsync,
    zremAsync
};
