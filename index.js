const Telegraf = require('telegraf');
const cron = require("node-cron");
const axios = require("axios");
const mongoose = require("mongoose")
const dotenv = require('dotenv');
dotenv.config();
mongoose.connect(`mongodb://${process.env.MONGO_URL}/telegramastrobot`, {useNewUrlParser: true});

const ChatSchema = new mongoose.Schema({
    id: {
        type: String,
        unique: true
    },
    username: String
});

const AdminMessageSchema = new mongoose.Schema({
    message: String,
    active: Boolean
})

const Chat = mongoose.model('Chat', ChatSchema);
const AdminMessage = mongoose.model('AdminMessage', AdminMessageSchema);

let data = {};
const db = mongoose.connection;
db.once('open', function() {
    cron.schedule("* * * * *", function() {
        axios.get(`https://api.nasa.gov/planetary/apod?api_key=${process.env.NASA_API_KEY}`).then(res => {
            data = res.data;
        })
    });

    axios.get(`https://api.nasa.gov/planetary/apod?api_key=${process.env.NASA_API_KEY}`).then(res => {
        data = res.data;
        const bot = new Telegraf(process.env.BOT_TOKEN)
        bot.start((ctx) => {
            ctx.getChat().then(chat => {
                const {id, username} = chat;
                const subscriber = new Chat({id, username});
                subscriber.save().catch(e => console.log("Duplicated user"));
            });
            ctx.reply("Welcome! I will send you the Astronomy Picture of the Day, along with a brief explanation written by a professional astronomer.\n\nI send the picture everyday at 12:00 AM (GMT +1)\n\nYou can get the picture whenever you want by typing /get\n\nIf I don't respond, type /start")
        })
        bot.command('get', (ctx) => {
            if (data.media_type === 'video'){
                ctx.reply(`${data.title}\n\n${data.explanation}\n\n${data.url}`)
            } else {
                ctx.replyWithPhoto(data.hdurl, {caption: `${data.title}\n\n${data.explanation}`})
            }
        });
        bot.command('stop', (ctx) => {
            ctx.getChat().then(chat => {
                Chat.deleteOne({id: chat.id}, (err) => {
                    ctx.reply("Okay, I'll stop sending you the Astronomy Picture of the day")
                })
            })
        })
        bot.command('getfromdate', (ctx) => {
            ctx.reply("Send me a date in the following format: YYYY-MM-DD (for example: 1997-12-03)");
        })
        bot.hears(/([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))/, (ctx) => {
            axios.get(`https://api.nasa.gov/planetary/apod?api_key=${process.env.NASA_API_KEY}&date=${ctx.message.text}`)
            .then(res => {
                const {data} = res;
                if (data.media_type === 'video'){
                    ctx.reply(`${data.title} (${data.date})\n\n${data.explanation}\n\n${data.url}`)
                } else {
                    ctx.replyWithPhoto(data.hdurl, {caption: `${data.title} (${data.date})\n\n${data.explanation}`})
                }
            })
            .catch(e => {
                ctx.reply(`${ctx.message.text} is not a valid date. Date must be between Jun 16, 1995 and today.`)
            })
        })
        cron.schedule("0 12 * * *", () => {
            const telegram = new Telegraf.Telegram(process.env.BOT_TOKEN);
            Chat.find({}, (err, chats) => {
                console.log(`${chats.length} active users`)
                if (!err) {
                    chats.map(chat => {
                        if (data.media_type === 'video'){
                            telegram.sendMessage(`${data.title}\n\n${data.explanation}\n\n${data.url}`)
                        } else {
                            telegram.sendPhoto(chat.id, data.hdurl, {caption: `${data.title}\n\n${data.explanation}`})     
                        }         
                    })
                }
            })
        })
        cron.schedule("* * * * *", () => {
            const telegram = new Telegraf.Telegram(process.env.BOT_TOKEN);
            AdminMessage.find({active: true}, (err, messages) => {
                if (messages.length > 0){
                    Chat.find({}, (err, chats) => {
                        if (!err) {
                            messages.map(message => {
                                chats.map(chat => {
                                    telegram.sendMessage(chat.id, message.message)        
                                })
                            })
                        }
                    })      
                    AdminMessage.updateMany({active: true}, {"$set":{"active": false}}, (err, raw) => {})
                }
            })
        })
        bot.launch()
    })    
});

