import TelegramBot from "node-telegram-bot-api";
import startRouter from "./router.start";


const router = (bot: TelegramBot) => {
    startRouter(bot);

    bot.on('polling_error', (e) => {
        console.error(e);
    });
}

export default router;