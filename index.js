const Telegraf = require('telegraf');
const cron = require("node-cron");
const axios = require("axios");
const dotenv = require('dotenv');
dotenv.config();

let data = {};

cron.schedule("1 0 * * *", function() {
    axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY').then(res => {
        data = res.data;
    })
});

axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY').then(res => {
    data = res.data;
    const bot = new Telegraf(process.env.BOT_TOKEN)
    bot.start((ctx) => {
        ctx.reply("Welcome! I will send you the Astronomy Picture of the Day, along with a brief explanation written by a professional astronomer.")
        cron.schedule("00 12 * * *", function() {
            ctx.replyWithPhoto(data.hdurl, {caption: `${data.title}\n\n${data.explanation}`})
        });
    })
    bot.command('get', (ctx) => {
        ctx.replyWithPhoto(data.hdurl, {caption: `${data.title}\n\n${data.explanation}`})
    });
    bot.launch()
})

