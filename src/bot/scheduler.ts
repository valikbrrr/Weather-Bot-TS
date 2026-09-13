// src/bot/scheduler.ts
import cron from "node-cron";
import { Telegraf } from "telegraf";
import { getWeatherByCity } from "./weather.js";
import { getClothingAdvice } from "./deepseek.js";
import fs from "node:fs";
import path from "node:path";

interface Subscription {
  chatId: number;
  city: string;
  time: string;
}

// Файл для хранения подписок
const STORAGE_FILE = path.resolve("subscriptions.json");

// Загружаем подписки из файла при старте
function loadSubscriptions(): Map<number, Subscription> {
  try {
    if (!fs.existsSync(STORAGE_FILE)) return new Map();
    const raw = fs.readFileSync(STORAGE_FILE, "utf-8");
    const arr: Subscription[] = JSON.parse(raw);
    return new Map(arr.map((s) => [s.chatId, s]));
  } catch (e) {
    console.error("⚠️ Не удалось загрузить subscriptions.json:", e);
    return new Map();
  }
}

// Сохраняем подписки в файл
function saveSubscriptions() {
  try {
    const arr = Array.from(subscriptions.values());
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(arr, null, 2), "utf-8");
  } catch (e) {
    console.error("⚠️ Не удалось сохранить subscriptions.json:", e);
  }
}

const subscriptions = loadSubscriptions();

export function addSubscription(chatId: number, city: string, time: string) {
  subscriptions.set(chatId, { chatId, city, time });
  saveSubscriptions();
  console.log(
    `📅 Подписка добавлена: чат ${chatId}, ${city} в ${time}. Всего: ${subscriptions.size}`,
  );
}

export function removeSubscription(chatId: number) {
  subscriptions.delete(chatId);
  saveSubscriptions();
  console.log(
    `🗑️ Подписка удалена: чат ${chatId}. Всего: ${subscriptions.size}`,
  );
}

export function startScheduler(bot: Telegraf<any>) {
  console.log(
    `⏰ Планировщик запущен. Загружено подписок: ${subscriptions.size}`,
  );
  console.log("⏰ Регистрирую cron-задачу '0 * * * * *'...");

  cron.schedule("0 * * * * *", async () => {
    console.log("⏰ Cron callback сработал!");

    const now = new Date();
    const currentTime = now.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    console.log(`⏰ Тик: ${currentTime}. Подписок: ${subscriptions.size}`);
    for (const [id, s] of subscriptions) {
      console.log(`   → чат ${id}: ${s.city} в "${s.time}"`);
    }

    for (const [chatId, sub] of subscriptions) {
      if (sub.time === currentTime) {
        console.log(`📤 Отправка в чат ${chatId} (${sub.city})...`);
        try {
          const weather = await getWeatherByCity(sub.city);
          if (!weather) {
            await bot.telegram.sendMessage(
              chatId,
              `❌ Не удалось получить погоду для города ${sub.city}.`,
            );
            continue;
          }

          const advice = await getClothingAdvice(weather);

          const message =
            `☀️ *Погода в ${sub.city}*\n` +
            `🌡️ ${weather.temperature}°C, ветер ${weather.windSpeed} м/с, ${weather.condition}\n\n` +
            `${advice}`;

          await bot.telegram.sendMessage(chatId, message, {
            parse_mode: "Markdown",
          });
          console.log(`✅ Отправлено в чат ${chatId}`);
        } catch (error) {
          console.error(`❌ Ошибка отправки в чат ${chatId}:`, error);
        }
      }
    }
  });

  console.log("⏰ Cron-задача зарегистрирована");
}
