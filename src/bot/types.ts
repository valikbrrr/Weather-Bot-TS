export interface WeatherData {
  temperature: number;
  windSpeed: number;
  condition: string; // "ясно", "дождь", "снег", "облачно"
  humidity?: number;
}

export interface SessionData {
  step: 'idle' | 'awaiting_weather';
  weather: WeatherData | null;
}