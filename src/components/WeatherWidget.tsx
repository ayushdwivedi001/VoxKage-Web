import React, { useEffect, useState } from "react";
import { 
  Sun, 
  Cloud, 
  CloudSun, 
  CloudRain, 
  CloudLightning, 
  CloudSnow, 
  Wind, 
  Droplets,
  Thermometer,
  Calendar,
  Clock,
  Compass
} from "lucide-react";

interface WeatherWidgetProps {
  lat?: number;
  lng?: number;
}

interface WeatherData {
  current: {
    temperature: number;
    apparent_temp: number;
    humidity: number;
    wind_speed: number;
    weather_code: number;
    is_day: number;
  };
  hourly: {
    time: string[];
    temperature: number[];
    weather_code: number[];
  };
  daily: {
    time: string[];
    temp_max: number[];
    temp_min: number[];
    weather_code: number[];
  };
}

export default function WeatherWidget({ lat, lng }: WeatherWidgetProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [cityName, setCityName] = useState("Selected Location");

  // Geolocation trigger or default coordinates
  useEffect(() => {
    if (lat !== undefined && lng !== undefined) {
      setCoords({ lat, lng });
      setCityName(lat === 20.88 && lng === 71.40 ? "Kovaya, Gujarat" : "Specified Coordinate");
    } else if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setCityName("Your Location");
        },
        () => {
          // Default to Kovaya, Gujarat if location blocked
          setCoords({ lat: 20.88, lng: 71.40 });
          setCityName("Kovaya, Gujarat (Default)");
        }
      );
    } else {
      // Default fallback
      setCoords({ lat: 20.88, lng: 71.40 });
      setCityName("Kovaya, Gujarat (Default)");
    }
  }, [lat, lng]);

  // Fetch Open-Meteo weather payload
  useEffect(() => {
    if (!coords) return;

    const fetchWeather = async () => {
      try {
        setLoading(true);
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Weather request failed");
        
        const data = await res.json();
        
        setWeather({
          current: {
            temperature: data.current.temperature_2m,
            apparent_temp: data.current.apparent_temperature,
            humidity: data.current.relative_humidity_2m,
            wind_speed: data.current.wind_speed_10m,
            weather_code: data.current.weather_code,
            is_day: data.current.is_day
          },
          hourly: {
            time: data.hourly.time.slice(0, 12), // next 12 hours
            temperature: data.hourly.temperature_2m.slice(0, 12),
            weather_code: data.hourly.weather_code.slice(0, 12)
          },
          daily: {
            time: data.daily.time,
            temp_max: data.daily.temperature_2m_max,
            temp_min: data.daily.temperature_2m_min,
            weather_code: data.daily.weather_code
          }
        });
      } catch (err: any) {
        setErrorMsg("Failed to retrieve weather reports.");
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [coords]);

  const getWeatherIcon = (code: number, sizeClass = "w-8 h-8") => {
    if (code === 0) {
      return <Sun className={`${sizeClass} text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]`} />;
    }
    if (code <= 3) {
      return <CloudSun className={`${sizeClass} text-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.4)]`} />;
    }
    if (code >= 51 && code <= 57) {
      return <CloudRain className={`${sizeClass} text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]`} />;
    }
    if (code >= 61 && code <= 67) {
      return <CloudRain className={`${sizeClass} text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]`} />;
    }
    if (code >= 71 && code <= 77) {
      return <CloudSnow className={`${sizeClass} text-teal-300 drop-shadow-[0_0_6px_rgba(110,231,183,0.5)]`} />;
    }
    if (code >= 80 && code <= 82) {
      return <CloudRain className={`${sizeClass} text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]`} />;
    }
    if (code >= 95) {
      return <CloudLightning className={`${sizeClass} text-violet-400 drop-shadow-[0_0_8px_rgba(167,139,250,0.7)]`} />;
    }
    return <Cloud className={`${sizeClass} text-zinc-350`} />;
  };

  const getTempClass = (temp: number) => {
    if (temp >= 30) {
      return "bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 bg-clip-text text-transparent font-medium";
    } else if (temp <= 15) {
      return "bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent font-medium";
    } else {
      return "bg-gradient-to-r from-zinc-150 to-zinc-300 bg-clip-text text-transparent font-medium";
    }
  };

  const getWeatherDescription = (code: number) => {
    if (code === 0) return "Clear Sky";
    if (code === 1) return "Mainly Clear";
    if (code === 2) return "Partly Cloudy";
    if (code === 3) return "Overcast";
    if (code >= 45 && code <= 48) return "Foggy";
    if (code >= 51 && code <= 55) return "Light Drizzle";
    if (code >= 61 && code <= 65) return "Rainy";
    if (code >= 71 && code <= 77) return "Snowy";
    if (code >= 80 && code <= 82) return "Rain Showers";
    if (code >= 95) return "Thunderstorms";
    return "Cloudy";
  };

  if (loading) {
    return (
      <div className="w-full max-w-[450px] p-5 my-4 rounded-2xl border border-zinc-850/60 bg-zinc-950/20 flex flex-col gap-4 animate-pulse select-none">
        <div className="h-5 w-2/3 bg-zinc-850 rounded"></div>
        <div className="flex gap-4 items-center">
          <div className="w-14 h-14 bg-zinc-850 rounded-full"></div>
          <div className="flex flex-col gap-2 flex-grow">
            <div className="h-8 w-1/3 bg-zinc-850 rounded"></div>
            <div className="h-4 w-1/2 bg-zinc-850 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg || !weather) {
    return (
      <div className="w-full max-w-[450px] p-5 my-4 rounded-2xl border border-zinc-850/60 bg-zinc-950/20 text-zinc-400 text-[13.5px] font-sans">
        {errorMsg || "Weather metrics unavailable."}
      </div>
    );
  }

  const currentTemp = Math.round(weather.current.temperature);
  const feelsLike = Math.round(weather.current.apparent_temp);

  return (
    <div className="w-full max-w-[650px] mx-auto my-4 rounded-2xl border border-zinc-850/60 bg-[#0e0e11]/80 backdrop-blur-md p-5 text-zinc-200 flex flex-col sm:flex-row gap-6 select-none shadow-xl font-sans relative overflow-hidden group">
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-[120px] h-[120px] bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/8 transition-all duration-500 pointer-events-none"></div>

      {/* Left Column: Current weather summary & highlights (42% width) */}
      <div className="w-full sm:w-[42%] flex flex-col gap-4 sm:border-r sm:border-zinc-850/30 sm:pr-6 justify-between">
        {/* Header Info */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-zinc-350 tracking-wide select-text">{cityName}</span>
            <span className="text-[12.5px] text-zinc-500">Current Forecast</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900/60 border border-zinc-850/60 px-2 py-0.5 rounded-md">
            Open-Meteo
          </span>
        </div>

        {/* Main Temp & Description Row */}
        <div className="flex items-center gap-4 my-2">
          <div className="p-2.5 rounded-2xl bg-zinc-950/30 border border-zinc-850/30 flex items-center justify-center">
            {getWeatherIcon(weather.current.weather_code, "w-12 h-12")}
          </div>
          <div className="flex flex-col">
            <div className="flex items-start">
              <span className={`text-5xl font-light tracking-tighter ${getTempClass(currentTemp)}`}>{currentTemp}</span>
              <span className="text-lg font-light text-zinc-400 mt-0.5 ml-0.5">°C</span>
            </div>
            <span className="text-[13.5px] font-medium text-zinc-400">
              {getWeatherDescription(weather.current.weather_code)}
            </span>
          </div>
        </div>

        {/* Details Grid (Stacked bottom-aligned) */}
        <div className="grid grid-cols-3 gap-2 bg-zinc-950/20 border border-zinc-850/40 rounded-xl p-3 text-[12px]">
          <div className="flex flex-col gap-1.5 items-center text-center">
            <Thermometer className="w-4 h-4 text-zinc-500" />
            <div className="flex flex-col">
              <span className="text-zinc-500 text-[11px]">Feels Like</span>
              <span className="font-semibold text-zinc-355">{feelsLike}°C</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 items-center text-center border-x border-zinc-850/40">
            <Droplets className="w-4 h-4 text-zinc-500" />
            <div className="flex flex-col">
              <span className="text-zinc-500 text-[11px]">Humidity</span>
              <span className="font-semibold text-zinc-355">{weather.current.humidity}%</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 items-center text-center">
            <Wind className="w-4 h-4 text-zinc-500" />
            <div className="flex flex-col">
              <span className="text-zinc-500 text-[11px]">Wind</span>
              <span className="font-semibold text-zinc-355">{weather.current.wind_speed} km/h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Hourly & Multi-Day Outlooks (58% width) */}
      <div className="w-full sm:w-[58%] flex flex-col gap-4 justify-between">
        {/* Hourly Timeline */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-zinc-500 select-text">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[12px] font-medium tracking-wide">Hourly Outlook</span>
          </div>
          
          <div className="flex gap-2.5 overflow-x-auto pb-2.5 custom-scrollbar snap-x snap-mandatory">
            {weather.hourly.time.map((timeStr, idx) => {
              const date = new Date(timeStr);
              const hour = date.getHours();
              const ampm = hour >= 12 ? "PM" : "AM";
              const hourLabel = `${hour % 12 || 12} ${ampm}`;
              const temp = Math.round(weather.hourly.temperature[idx]);
              const code = weather.hourly.weather_code[idx];

              return (
                <div key={idx} className="flex flex-col items-center gap-1.5 flex-shrink-0 min-w-[52px] bg-zinc-950/10 border border-zinc-850/20 rounded-lg p-2 snap-start">
                  <span className="text-[11px] text-zinc-500">{hourLabel}</span>
                  {getWeatherIcon(code, "w-4.5 h-4.5")}
                  <span className={`text-[12px] font-medium ${getTempClass(temp)}`}>{temp}°</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3-Day Forecast Outlook */}
        <div className="flex flex-col gap-2 border-t border-zinc-850/40 pt-4">
          <div className="flex items-center gap-1.5 text-zinc-500">
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-[12px] font-medium tracking-wide">3-Day Forecast</span>
          </div>

          <div className="flex flex-col gap-2">
            {weather.daily.time.map((dayStr, idx) => {
              const date = new Date(dayStr);
              const today = new Date().toDateString();
              const dayLabel = date.toDateString() === today 
                ? "Today" 
                : date.toLocaleDateString("en-US", { weekday: "short" });
              const maxTemp = Math.round(weather.daily.temp_max[idx]);
              const minTemp = Math.round(weather.daily.temp_min[idx]);
              const code = weather.daily.weather_code[idx];

              return (
                <div key={idx} className="flex items-center justify-between text-[12.5px] bg-zinc-950/10 border border-zinc-850/10 p-2 rounded-xl">
                  <span className="w-14 font-medium text-zinc-400">{dayLabel}</span>
                  <div className="flex items-center gap-2">
                    {getWeatherIcon(code, "w-4.5 h-4.5")}
                    <span className="text-[11.5px] text-zinc-500">{getWeatherDescription(code)}</span>
                  </div>
                  <div className="flex gap-2 font-mono text-[11.5px]">
                    <span className={`font-semibold ${getTempClass(maxTemp)}`}>{maxTemp}°</span>
                    <span className="text-zinc-600">/</span>
                    <span className={`font-medium ${getTempClass(minTemp)}`}>{minTemp}°</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Custom thin horizontal scrollbar */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 9999px;
          transition: background 0.2s;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>
    </div>
  );
}
