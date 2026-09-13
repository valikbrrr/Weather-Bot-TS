// src/bot/types.ts

export interface WeatherData {
  temperature: number;
  windSpeed: number;
  condition: string; // "ясно", "дождь", "снег", "облачно"
  humidity?: number;
}

// Дополняем тип для сессии
export interface SessionData {
  step: 'idle' | 'awaiting_weather' | 'awaiting_city' | 'awaiting_time';
  city?: string; // <-- Добавляем город
  notificationTime?: string; // <-- Добавляем время в формате 'HH:mm'
  weather: WeatherData | null;
}

// Тип для ответа геокодинга
export interface GeocodingResult {
  results?: {
    name: string;
    latitude: number;
    longitude: number;
    country: string;
  }[];
}