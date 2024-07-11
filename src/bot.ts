import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { MoralisStart } from "./util/helper";
dotenv.config();

const token = process.env.TELEGRAM_TOKEN;
if (!token) {
    console.error("Bot token is not set in .env");
    process.exit(1);
}
console.log("Bot token:", token);
// Create a new Telegram bot using polling to fetch new updates
const bot = new TelegramBot(token, { polling: true });

MoralisStart().then(() => {
    console.log("Moralis started!");
});

export default bot;