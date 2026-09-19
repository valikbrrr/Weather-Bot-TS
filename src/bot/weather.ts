import axios from "axios";
import { WeatherData, GeocodingResult } from "./types.js";

// Интерфейс для ответа Open-Meteo (текущая погода)
interface OpenMeteoCurrentResponse {
  current: {
    temperature_2m: number;
    wind_speed_10m: number;
    weather_code: number; // Код погоды WMO
  };
}

// Интерфейс для ответа Open-Meteo (почасовой прогноз)
interface OpenMeteoHourlyResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    wind_speed_10m: number[];
    weather_code: number[];
  };
}

// Интерфейс для ответа Nominatim (OpenStreetMap)
interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  type: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

// Прогноз на день (3 периода)
export interface DailyForecast {
  morning: WeatherData;
  afternoon: WeatherData;
  evening: WeatherData;
}

/**
 * Получает координаты города через Open-Meteo Geocoding API
 */
async function getCoordinatesOpenMeteo(
  city: string,
): Promise<{ lat: number; lon: number } | null> {
  try {
    const response = await axios.get<GeocodingResult>(
      "https://geocoding-api.open-meteo.com/v1/search",
      {
        params: {
          name: city,
          count: 1,
          language: "ru",
        },
        timeout: 10000,
      },
    );

    const result = response.data.results?.[0];
    if (!result) {
      console.warn(`⚠️ Open-Meteo: город "${city}" не найден`);
      return null;
    }

    console.log(
      `✅ Open-Meteo: найден "${result.name}" (${result.latitude}, ${result.longitude})`,
    );
    return { lat: result.latitude, lon: result.longitude };
  } catch (error) {
    console.error("❌ Ошибка Open-Meteo Geocoding API:", error);
    return null;
  }
}

async function getCoordinatesNominatim(
  city: string,
): Promise<{ lat: number; lon: number } | null> {
  try {
    const response = await axios.get<NominatimResult[]>(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          q: city,
          format: "json",
          limit: 1,
          addressdetails: 1,
          "accept-language": "ru",
        },
        headers: {
          // Nominatim требует User-Agent для идентификации приложения
          "User-Agent": "WeatherClothingBot/1.0 (https://github.com/)",
        },
        timeout: 10000,
      },
    );

    const result = response.data?.[0];
    if (!result) {
      console.warn(`⚠️ Nominatim: город "${city}" не найден`);
      return null;
    }

    console.log(
      `✅ Nominatim: найден "${result.display_name}" (${result.lat}, ${result.lon})`,
    );
    return { lat: parseFloat(result.lat), lon: parseFloat(result.lon) };
  } catch (error) {
    console.error("❌ Ошибка Nominatim API:", error);
    return null;
  }
}

async function getCoordinates(
  city: string,
): Promise<{ lat: number; lon: number } | null> {
  let coords = await getCoordinatesOpenMeteo(city);

  if (!coords) {
    console.log(`🔄 Open-Meteo не нашёл "${city}", пробую Nominatim...`);
    coords = await getCoordinatesNominatim(city);
  }

  return coords;
}

function decodeWeatherCode(code: number): string {
  if (code === 0) return "ясно";
  if ([1, 2, 3].includes(code)) return "облачно";
  if ([45, 48].includes(code)) return "туман";
  if ([51, 53, 55].includes(code)) return "морось";
  if ([61, 63, 65].includes(code)) return "дождь";
  if ([71, 73, 75].includes(code)) return "снег";
  if ([80, 81, 82].includes(code)) return "ливень";
  if (code === 95) return "гроза";
  return "неизвестно";
}

/**
 * Основная функция получения ТЕКУЩЕЙ погоды по названию города
 * (используется для ручного ввода и как fallback)
 */
export async function getWeatherByCity(
  city: string,
): Promise<WeatherData | null> {
  const coords = await getCoordinates(city);
  if (!coords) return null;

  try {
    const response = await axios.get<OpenMeteoCurrentResponse>(
      "https://api.open-meteo.com/v1/forecast",
      {
        params: {
          latitude: coords.lat,
          longitude: coords.lon,
          current: ["temperature_2m", "wind_speed_10m", "weather_code"],
          wind_speed_unit: "kmh",
          timezone: "auto",
        },
        timeout: 10000,
      },
    );

    const current = response.data.current;

    return {
      temperature: Math.round(current.temperature_2m),
      windSpeed: Math.round(current.wind_speed_10m),
      condition: decodeWeatherCode(current.weather_code),
    };
  } catch (error) {
    console.error("❌ Ошибка Forecast API:", error);
    return null;
  }
}

/**
 * Получает прогноз погоды на конкретные часы (8:00, 14:00, 20:00) на сегодня
 */
export async function getDailyForecast(
  city: string,
): Promise<DailyForecast | null> {
  const coords = await getCoordinates(city);
  if (!coords) return null;

  try {
    const response = await axios.get<OpenMeteoHourlyResponse>(
      "https://api.open-meteo.com/v1/forecast",
      {
        params: {
          latitude: coords.lat,
          longitude: coords.lon,
          hourly: ["temperature_2m", "wind_speed_10m", "weather_code"],
          wind_speed_unit: "kmh",
          timezone: "auto",
          forecast_days: 1,
        },
        timeout: 10000,
      },
    );

    const hourly = response.data.hourly;
    if (!hourly || !hourly.time) {
      console.warn("⚠️ Пустой почасовой прогноз");
      return null;
    }

    // Ищем индекс времени, соответствующего нужному часу
    const getDataForHour = (targetHour: number): WeatherData => {
      const index = hourly.time.findIndex((t: string) => {
        // t приходит в формате "2025-01-15T08:00"
        const hour = parseInt(t.split("T")[1].split(":")[0], 10);
        return hour === targetHour;
      });

      if (index === -1) {
        console.warn(`⚠️ Не найдены данные для часа ${targetHour}:00`);
        return { temperature: 0, windSpeed: 0, condition: "нет данных" };
      }

      return {
        temperature: Math.round(hourly.temperature_2m[index]),
        windSpeed: Math.round(hourly.wind_speed_10m[index]),
        condition: decodeWeatherCode(hourly.weather_code[index]),
      };
    };

    return {
      morning: getDataForHour(8),
      afternoon: getDataForHour(14),
      evening: getDataForHour(20),
    };
  } catch (error) {
    console.error("❌ Ошибка Forecast API (Daily):", error);
    return null;
  }
}
