import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const API_KEY = process.env.DEEPSEEK_API_KEY!;
const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.aiai.by/v1";

const MODELS = [
  "deepseek-v3.2",
  "deepseek-v3.1-terminus",
  "deepseek-v4-pro",
  "deepseek-v4-flash"
];

async function testAllModels() {
  console.log("🧪 Тестируем все модели...\n");

  for (const model of MODELS) {
    console.log(`🔄 Тестируем: ${model}...`);
    
    try {
      const response = await axios.post(
        `${BASE_URL}/chat/completions`,
        {
          model: model,
          messages: [
            { role: "system", content: "Отвечай кратко, только ответ." },
            { role: "user", content: "Сколько будет 2+2?" }
          ],
          max_tokens: 50
        },
        {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: 10000
        }
      );

      const message = response.data.choices?.[0]?.message;
      const content = message?.content || message?.reasoning || message?.reasoning_content;
      
      if (content) {
        console.log(`✅ ${model} РАБОТАЕТ! Ответ: ${content.substring(0, 100)}...`);
        console.log(`📊 content: ${message?.content ? 'есть' : 'нет'}`);
        console.log(`📊 reasoning: ${message?.reasoning ? 'есть' : 'нет'}\n`);
      } else {
        console.log(`⚠️ ${model} вернул ответ без content/reasoning`);
        console.log(`📊 message:`, JSON.stringify(message, null, 2), '\n');
      }
      
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.log(`❌ ${model} - недоступен (403)\n`);
      } else {
        console.log(`❌ ${model} - ошибка: ${error.message}\n`);
      }
    }
  }
}

testAllModels();