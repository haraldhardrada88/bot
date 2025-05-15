const { Telegraf } = require('telegraf');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const bot = new Telegraf(process.env.BOT_TOKEN);
const sessions = new Map();

require('./handlers/auth')(bot, prisma, sessions);
require('./handlers/user')(bot, prisma, sessions);

bot.launch().then(()=>console.log('Started')).catch(console.error);