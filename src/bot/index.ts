// src/bot/index.ts
import { Telegraf, session, Context } from "telegraf";
import { getClothingAdvice } from "./deepseek.js";
import { SessionData } from "./types.js";
import { BOT_TOKEN } from "./env.js";
import {
  startScheduler,
  addSubscription,
  removeSubscription,
} from "./scheduler.js";

const bot = new Telegraf<Context & { session: SessionData }>(BOT_TOKEN);

// --- Сессии (чтобы запоминать состояние пользователя) ---
bot.use(
  session({
    defaultSession: (): SessionData => ({
      step: "idle",
      weather: null,
      city: undefined,
      notificationTime: undefined,
    }),
  }),
);

// --- Команда /start ---
bot.command("start", async (ctx) => {
  ctx.session.step = "awaiting_city";
  ctx.session.city = undefined;
  ctx.session.notificationTime = undefined;
  ctx.session.weather = null;

  await ctx.reply(
    "👋 Привет! Я помогу тебе выбрать одежду по погоде и могу присылать ежедневные уведомления.\n\n" +
      "📍 *Шаг 1 из 2.* Напиши название города, для которого нужны оповещения:\n" +
      "_(например: Минск, Москва, Санкт-Петербург)_",
    { parse_mode: "Markdown" },
  );
});

// --- Команда /help ---
bot.command("help", async (ctx) => {
  await ctx.reply(
    "📖 *Как я работаю:*\n\n" +
      "🔔 *Автоматические уведомления:*\n" +
      "1. Отправь /start\n" +
      "2. Укажи город\n" +
      "3. Укажи время в формате ЧЧ:ММ\n" +
      "4. Я буду присылать прогноз каждый день в это время\n\n" +
      "✍️ *Ручной ввод погоды:*\n" +
      "Просто отправь погоду текстом, и я дам совет по одежде.\n\n" +
      "Примеры:\n" +
      '• "Температура 20°C, ветер 3 м/с, солнечно"\n' +
      '• "Сегодня дождь, +10°C, ветер сильный"\n' +
      '• "-5°C, снег, ветер 7 м/с"\n\n' +
      "Команды:\n" +
      "/start — настроить уведомления\n" +
      "/stop — отключить уведомления\n" +
      "/help — эта справка\n" +
      "/about — о боте",
    { parse_mode: "Markdown" },
  );
});

// --- Команда /stop (отключение уведомлений) ---
bot.command("stop", async (ctx) => {
  removeSubscription(ctx.chat!.id);
  ctx.session.step = "idle";
  ctx.session.city = undefined;
  ctx.session.notificationTime = undefined;
  await ctx.reply(
    "🔕 Уведомления отключены. Чтобы снова включить — напиши /start.",
  );
});

// --- Обработчик текстовых сообщений ---
bot.on("text", async (ctx) => {
  const userText = ctx.message.text.trim();

  // --- Шаг 1: Получение города ---
  if (ctx.session.step === "awaiting_city") {
    if (userText.startsWith("/")) {
      await ctx.reply(
        "Пожалуйста, напиши название города текстом (например, Минск).",
      );
      return;
    }

    ctx.session.city = userText;
    ctx.session.step = "awaiting_time";

    await ctx.reply(
      `✅ Город сохранён: *${userText}*\n\n` +
        "⏰ *Шаг 2 из 2.* Напиши время, в которое я буду присылать прогноз, в формате *ЧЧ:ММ*:\n" +
        "_(например: 08:30 или 19:00)_",
      { parse_mode: "Markdown" },
    );
    return;
  }

  // --- Шаг 2: Получение времени ---
  if (ctx.session.step === "awaiting_time") {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (!timeRegex.test(userText)) {
      await ctx.reply(
        "❌ Неверный формат времени. Попробуй ещё раз в формате *ЧЧ:ММ* (например, 08:30 или 15:45).",
        { parse_mode: "Markdown" },
      );
      return;
    }

    ctx.session.notificationTime = userText;
    ctx.session.step = "idle";

    // Добавляем подписку в планировщик
    addSubscription(ctx.chat!.id, ctx.session.city!, userText);

    await ctx.reply(
      `🎉 Готово! Буду присылать прогноз для города *${ctx.session.city}* каждый день в *${userText}*.\n\n` +
        "А пока ты можешь прислать погоду текстом, и я сразу дам совет по одежде.\n\n" +
        "Отключить уведомления — /stop",
      { parse_mode: "Markdown" },
    );
    return;
  }

  // --- Шаг 3: Ручной ввод погоды (старая логика) ---
  if (ctx.session.step === "idle") {
    const weather = parseWeather(userText);

    if (!weather) {
      await ctx.reply(
        "❌ Не смог понять погоду из твоего сообщения.\n\n" +
          "Попробуй указать:\n" +
          "• Температуру (число + °C или C)\n" +
          "• Скорость ветра (число + м/с)\n" +
          "• Осадки (дождь/снег/солнечно/облачно)\n\n" +
          "Или отправь /help для примеров и настройки уведомлений.",
      );
      return;
    }

    await ctx.reply("🤔 Анализирую погоду и подбираю образ...");

    try {
      const advice = await getClothingAdvice(weather);

      ctx.session.weather = weather;

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
    return;
  }

  // На всякий случай
  await ctx.reply(
    "🔔 Напиши /start, чтобы настроить уведомления, или /help для справки.",
  );
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

  if (temperature === null) return null;

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
    "🤖 *Бот для погоды*\n\n" +
      "• Автоматические уведомления о погоде в заданное время\n" +
      "• Совет по одежде через DeepSeek V4 Flash\n" +
      "• Данные о погоде: Open-Meteo (бесплатно)",
    { parse_mode: "Markdown" },
  );
});

// --- Запуск бота с retry при 409 Conflict ---
async function launchWithRetry(bot: Telegraf<any>, maxRetries = 5) {
  console.log("🔧 launchWithRetry: начинаю запуск...");
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔧 Попытка ${attempt}/${maxRetries}: bot.launch()...`);
      await bot.launch();
      console.log("🚀 Бот запущен!");
      return;
    } catch (error: any) {
      if (error.response?.error_code === 409) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        console.warn(
          `⚠️ 409 Conflict (попытка ${attempt}/${maxRetries}). Ждём ${delay}мс...`,
        );
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw error; // другие ошибки не ретраим
      }
    }
  }
  throw new Error("Не удалось запустить бота после всех попыток");
}

startScheduler(bot);
console.log("✅ startScheduler вызван");

launchWithRetry(bot).catch((err) => {
  console.error("❌ Ошибка запуска:", err);
  process.exit(1);
});

// Graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
