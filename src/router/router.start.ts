import TelegramBot from "node-telegram-bot-api";
import { 
    createSignal,
    tokenBuy,
    scrapeMessages,
    tokenSell
} from "../startTrade";
import { msgCatchInternalDuration, sellInternalDuration } from "../config";

const startRouter = (bot: TelegramBot) => {
    // Session state for each chat
    const sessions: any = {};
    let globalChatId: any;

    // Define the inline keyboard layout for interaction
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🛒 Buy", callback_data: "buy" }, { text: "📈 Sell", callback_data: "sell" }],
                [{ text: "💼 Help", callback_data: "help" }, { text: "📬 Channel", url: "https://t.me/Maestrosdegen" }]
            ],
        },
    };

    const selectedBuyOptions = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🛒 Manual Buy", callback_data: "manual_buy" }],
                [{ text: "🚀 Auto Buy", callback_data: "auto_buy" }]
            ],
        },
    };

    const stopOptions = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🛒 Stop Trading", callback_data: "stop_buy" }],
            ],
        },
    };

    bot.onText(/\/start/, (msg: any) => {
        const chatId = msg.chat.id;
        console.log("chatId", chatId);
        const welcomeMessage = "🍄 Welcome to my soltank_bot!\n\n`AAEuA3DeoblV-LZQwoexDgWJoM2Tg0-E2Ns                                   `\n\n`https://t.me/mysol_tankbot`\n\n 🥞 Please choose a category below:";
        bot.sendMessage(chatId, welcomeMessage, options);
    });

    bot.on("callback_query", (callbackQuery: any) => {

        const message = callbackQuery.message;
        const category = callbackQuery.data;
        const chatId = message.chat.id;
        globalChatId = chatId;

        let tokenBuyInterval;
        let tokenSellInterval;

        if (!sessions[chatId]) {
            sessions[chatId] = { waitingForAmount: false, waitingForTokenAddress: false };
        }

        if (category === "buy") {
            bot.sendMessage(chatId, "🏆 Choose your buy method:                  ", selectedBuyOptions);
        } else if (category === "manual_buy") {
            sessions[chatId].waitingForAmount = true;
            bot.sendMessage(chatId, "✍ Input the amount you want to buy ...  (sol)     \n⚱️  For example: 1.25                      ");
        } else if (category === "auto_buy") {
            bot.sendMessage(chatId, "✍ Starting auto buy right now");
            // Catch signal from signal channel
            clearInterval(tokenBuyInterval);
            tokenBuyInterval = setInterval(scrapeMessages, msgCatchInternalDuration);
            clearInterval(tokenSellInterval);
            tokenSellInterval = setInterval(tokenSell, sellInternalDuration);

        } else if (category === "stop_buy") {
            clearInterval(tokenSellInterval);
            bot.sendMessage(chatId, "🏆 Choose your buy method:                  ", selectedBuyOptions);
        }
    });

    bot.on("message", async (msg: any) => {
        const chatId = msg.chat.id;
        const session = sessions[chatId];

        if (!session) return; // Ignore messages if session isn't initialized

        if (session.waitingForTokenAddress) {
            const tokenAddress = msg.text.trim();
            if (tokenAddress) {
                console.log("Token address:", tokenAddress);
                session.tokenAddress = tokenAddress;
                session.waitingForTokenAddress = false;      
                await bot.sendMessage(chatId, `👌 Success! Ready for swap ...                                                 \n\n💰 Amount: ${session.amount.toFixed(6)} SOL           \n🤝 Token Address: ${tokenAddress}`);
                // console.log("----***--SwapConfig---***---", swapConfig(tokenAddress, session.amount));
                await bot.sendMessage(chatId, `Token: ${tokenAddress}, Amount: ${session.amount} SOL`);
                if (createSignal(tokenAddress, session.amount)){
                    await tokenBuy();
                }
                await bot.sendMessage(chatId, "🏆 Choose your buy method:                  ", selectedBuyOptions);
                await bot.sendMessage(chatId, "Buy Success!      \nIf you want to stop manual token buy, please click Stop button...", stopOptions);
                delete sessions[chatId]; // Clear session after completion
            }
        } else if (session.waitingForAmount) {
            const amount = parseFloat(msg.text);
            if (!isNaN(amount)) {
                session.amount = amount;
                session.waitingForAmount = false;
                session.waitingForTokenAddress = true;
                bot.sendMessage(chatId, "🧧 Input the token address you want to buy ...  (sol)     \n\n⚱️  For example: CXeaSFtgwDJ6HKrGNNxtDEwydUcbZySx8rhJmoJBkEy3      ");
            } else {
                bot.sendMessage(chatId, "Invalid amount. Please enter a valid number.");
            }
        }
    });

    return {
        sellEnd: () => {
            bot.sendMessage(globalChatId, "Buy Success!      \nIf you want to stop token auto sell, please click Stop button...", stopOptions);
        }
    }    
}


export default startRouter;