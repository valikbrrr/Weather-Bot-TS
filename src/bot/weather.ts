// src/bot/weather.ts
import axios from 'axios';
import { WeatherData, GeocodingResult } from './types.js';

// Интерфейс для ответа Open-Meteo (упрощенный)
interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    wind_speed_10m: number;
    weather_code: number; // Код погоды WMO
  };
}

/**
 * Получает координаты города через Geocoding API
 */
async function getCoordinates(city: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const response = await axios.get<GeocodingResult>(
      'https://geocoding-api.open-meteo.com/v1/search',
      {
        params: {
          name: city,
          count: 1, // Берем только первый результат
          language: 'ru', // Пытаемся получить локализованное название
        },
        timeout: 10000,
      }
    );

    const result = response.data.results?.[0];
    if (!result) {
      console.warn(`⚠️ Город "${city}" не найден в Geocoding API`);
      return null;
    }

    return { lat: result.latitude, lon: result.longitude };
  } catch (error) {
    console.error('❌ Ошибка Geocoding API:', error);
    return null;
  }
}

/**
 * Расшифровывает код погоды WMO в текстовое описание
 * (Стандартные коды для Open-Meteo)
 */
function decodeWeatherCode(code: number): string {
  // 0: Ясно, 1-3: Облачно, 45,48: Туман, 51-55: Морось,
  // 61-65: Дождь, 71-75: Снег, 80-82: Ливень, 95: Гроза
  if (code === 0) return 'ясно';
  if ([1, 2, 3].includes(code)) return 'облачно';
  if ([45, 48].includes(code)) return 'туман';
  if ([51, 53, 55].includes(code)) return 'морось';
  if ([61, 63, 65].includes(code)) return 'дождь';
  if ([71, 73, 75].includes(code)) return 'снег';
  if ([80, 81, 82].includes(code)) return 'ливень';
  if (code === 95) return 'гроза';
  return 'неизвестно';
}

/**
 * Основная функция получения погоды по названию города
 */
export async function getWeatherByCity(city: string): Promise<WeatherData | null> {
  const coords = await getCoordinates(city);
  if (!coords) return null;

  try {
    const response = await axios.get<OpenMeteoResponse>(
      'https://api.open-meteo.com/v1/forecast',
      {
        params: {
          latitude: coords.lat,
          longitude: coords.lon,
          current: ['temperature_2m', 'wind_speed_10m', 'weather_code'],
          wind_speed_unit: 'ms', // Метры в секунду
          timezone: 'auto', // Автоматически по часовому поясу
        },
        timeout: 10000,
      }
    );

    const current = response.data.current;
    
    return {
      temperature: Math.round(current.temperature_2m),
      windSpeed: Math.round(current.wind_speed_10m),
      condition: decodeWeatherCode(current.weather_code),
    };
  } catch (error) {
    console.error('❌ Ошибка Forecast API:', error);
    return null;
  }
}