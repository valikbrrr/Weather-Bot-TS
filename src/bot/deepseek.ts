import axios from "axios";
import { WeatherData } from "./types.js";
import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL } from "./env.js";

const MODEL = "deepseek-v4-flash";

export async function getClothingAdvice(weather: WeatherData): Promise<string> {
  const prompt = `
Ты — умный помощник по выбору одежды. Пользователь сообщил тебе погоду.
На основе этих данных дай чёткую, практичную рекомендацию, что надеть на улицу сегодня.

Погодные данные:
- Температура: ${weather.temperature}°C
- Ветер: ${weather.windSpeed} м/с
- Осадки: ${weather.condition}

Ответь в формате:
🌡️ Рекомендация: ...
🧥 Что надеть: ...
⚠️ Дополнительный совет: ...

Будь конкретным, дружелюбным и полезным. Не добавляй лишней информации.
`;

  try {
    console.log("📤 Отправка запроса к DeepSeek API...");
    console.log(`🤖 Модель: ${MODEL}`);
    console.log(`🔑 Ключ: ${DEEPSEEK_API_KEY.substring(0, 15)}...`);

    const requestData = {
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "Ты — экспертный стилист и синоптик в одном лице. Отвечай сразу результатом, без рассуждений.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
    };

    const response = await axios.post(
      `${DEEPSEEK_BASE_URL}/chat/completions`,
      requestData,
      {
        headers: {
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      },
    );

    console.log("✅ Успешный ответ от API");

    const data = response.data;
    const message = data.choices?.[0]?.message;

    // Извлекаем ответ
    let reply = message?.content || null;

    // Если content пустой, пробуем reasoning
    if (!reply && message?.reasoning) {
      // Ищем финальный ответ в рассуждениях
      const reasoning = message.reasoning;
      const match = reasoning.match(/["«]([^"»]+)["»]\s*$/);
      reply = match ? match[1] : reasoning;
    }

    if (!reply && message?.reasoning_details?.length > 0) {
      reply = message.reasoning_details.map((d: any) => d.text).join("");
    }

    if (!reply) {
      console.error("❌ Не удалось извлечь ответ:", JSON.stringify(message, null, 2));
      return "❌ Не удалось получить ответ от ИИ. Попробуйте позже.";
    }

    return reply;
  } catch (error: any) {
    console.error("❌ Ошибка DeepSeek API:");

    if (error.response) {
      console.error(`📊 Статус: ${error.response.status}`);
      console.error(`📝 Данные:`, JSON.stringify(error.response.data, null, 2));

      if (error.response.status === 401) {
        return "❌ Ошибка авторизации. Проверьте API-ключ.";
      } else if (error.response.status === 402) {
        return "❌ Недостаточно средств на балансе.";
      } else if (error.response.status === 403) {
        return `❌ Модель ${MODEL} недоступна.`;
      } else if (error.response.status === 429) {
        return "❌ Слишком много запросов. Подождите.";
      } else {
        return `❌ Ошибка API (${error.response.status}).`;
      }
    } else if (error.request) {
      return "❌ Сервер не отвечает.";
    } else {
      return "❌ Внутренняя ошибка.";
    }
  }
}