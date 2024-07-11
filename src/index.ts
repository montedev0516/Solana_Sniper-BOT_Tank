const TelegramBot = require("node-telegram-bot-api");

import bot from "./bot"
import router from './router';

( () => {
  router(bot);  
})();

// ( () => {
//   // main();
// })();





