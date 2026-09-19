import dotenv from 'dotenv';

dotenv.config();

export const BOT_TOKEN = process.env.BOT_TOKEN!;
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY!;
export const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.aiai.by/v1';

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не найден в .env');
  process.exit(1);
}
if (!DEEPSEEK_API_KEY) {
  console.error('❌ DEEPSEEK_API_KEY не найден в .env');
  process.exit(1);
}