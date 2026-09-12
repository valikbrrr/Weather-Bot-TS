import { Telegraf, session, Context } from "telegraf";
import { getClothingAdvice } from "./deepseek.js";
import { SessionData } from "./types.js";
import { BOT_TOKEN } from "./env.js"; // ← импорт из env.ts

const bot = new Telegraf<Context & { session: SessionData }>(BOT_TOKEN);

// --- Сессии (чтобы запоминать состояние пользователя) ---
bot.use(
  session({
    defaultSession: (): SessionData => ({
      step: "idle",
      weather: null,
    }),
  }),
);

// --- Команда /start ---
bot.command("start", async (ctx) => {
  ctx.session.step = "awaiting_weather";
  ctx.session.weather = null;

  await ctx.reply(
    "👋 Привет! Я помогу тебе выбрать одежду по погоде.\n\n" +
      "Отправь мне погоду в таком формате:\n" +
      "`Температура: 15°C, Ветер: 5 м/с, Осадки: дождь`\n\n" +
      "Или просто расскажи как есть — я пойму 😊",
    { parse_mode: "Markdown" },
  );
});

// --- Команда /help ---
bot.command("help", async (ctx) => {
  await ctx.reply(
    "📖 *Как я работаю:*\n\n" +
      "1. Отправь мне погоду в любом удобном формате\n" +
      "2. Я обработаю данные и дам совет, что надеть\n\n" +
      "Примеры сообщений:\n" +
      '• "Температура 20°C, ветер 3 м/с, солнечно"\n' +
      '• "Сегодня дождь, +10°C, ветер сильный"\n' +
      '• "-5°C, снег, ветер 7 м/с"\n\n' +
      "Для перезапуска используй команду /start",
    { parse_mode: "Markdown" },
  );
});

// --- Обработчик текстовых сообщений ---
bot.on("text", async (ctx) => {
  // Если бот не ждёт погоду — напоминаем
  if (ctx.session.step !== "awaiting_weather") {
    await ctx.reply("🔔 Напиши /start, чтобы получить рекомендацию по погоде.");
    return;
  }

  const userText = ctx.message.text;

  // --- Парсим погоду из текста ---
  const weather = parseWeather(userText);

  if (!weather) {
    await ctx.reply(
      "❌ Не смог понять погоду из твоего сообщения.\n\n" +
        "Попробуй указать:\n" +
        "• Температуру (число + °C или C)\n" +
        "• Скорость ветра (число + м/с)\n" +
        "• Осадки (дождь/снег/солнечно/облачно)\n\n" +
        "Или отправь команду /help для примеров.",
    );
    return;
  }

  // Показываем, что бот думает
  await ctx.reply("🤔 Анализирую погоду и подбираю образ...");

  try {
    // Запрашиваем рекомендацию у DeepSeek
    const advice = await getClothingAdvice(weather);

    // Сохраняем в сессию (на будущее)
    ctx.session.weather = weather;
    ctx.session.step = "idle";

    // Отправляем результат
    await ctx.reply(
      `✅ *Погода принята:*\n` +
        `🌡️ ${weather.temperature}°C, ветер ${weather.windSpeed} м/с, ${weather.condition}\n\n` +
        `${advice}`,
      { parse_mode: "Markdown" },
    );
  } catch (error) {
    console.error("Ошибка в обработчике:", error);
    await ctx.reply("❌ Произошла ошибка. Попробуйте позже.");
  }
});

// --- Функция парсинга погоды из текста ---
function parseWeather(text: string): SessionData["weather"] | null {
  const lower = text.toLowerCase();

  // Извлекаем температуру
  const tempMatch =
    text.match(/([-+]?\d+)\s*[°C]/i) || text.match(/([-+]?\d+)\s*[C]/i);
  const temperature = tempMatch ? parseFloat(tempMatch[1]) : null;

  // Извлекаем скорость ветра
  const windMatch = text.match(/(\d+)\s*[м\/с]/i);
  const windSpeed = windMatch ? parseFloat(windMatch[1]) : null;

  // Определяем осадки
  let condition = "неизвестно";
  if (
    lower.includes("дождь") ||
    lower.includes("ливень") ||
    lower.includes("морос")
  )
    condition = "дождь";
  else if (
    lower.includes("снег") ||
    lower.includes("метель") ||
    lower.includes("позём")
  )
    condition = "снег";
  else if (
    lower.includes("солн") ||
    lower.includes("ясн") ||
    lower.includes("безобла")
  )
    condition = "ясно";
  else if (
    lower.includes("облач") ||
    lower.includes("пасмурн") ||
    lower.includes("туч")
  )
    condition = "облачно";

  // Если нет температуры — не можем дать совет
  if (temperature === null) {
    return null;
  }

  // Если нет скорости ветра — ставим 0
  const finalWind = windSpeed !== null ? windSpeed : 0;

  return {
    temperature,
    windSpeed: finalWind,
    condition,
  };
}

// --- Команда /about (инфо о боте) ---
bot.command("about", async (ctx) => {
  await ctx.reply(
    "🤖 *Бот-стилист для погоды*\n\n" +
      "Использует DeepSeek V4 Flash для анализа погоды\n" +
      "и подбора одежды.\n\n" +
      "Разработан для тестирования интеграции с Vedai API.",
  );
});

// --- Запуск бота ---
bot
  .launch()
  .then(() => console.log("🚀 Бот запущен!"))
  .catch((err) => console.error("❌ Ошибка запуска:", err));

// Graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
