"use client";

import React, { useEffect, useState, useId } from "react";
import { 
  Sun, 
  Cloud, 
  CloudSun, 
  CloudRain, 
  CloudLightning, 
  CloudSnow, 
  Wind as WindIcon, 
  Droplets,
  Thermometer,
  Calendar,
  Clock,
  ArrowUp
} from "lucide-react";

interface WeatherWidgetProps {
  lat?: number;
  lng?: number;
  isExpanded?: boolean;
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
    precipitation_probability: number[];
    wind_speed: number[];
    wind_direction: number[];
    weather_code: number[];
  };
  daily: {
    time: string[];
    temp_max: number[];
    temp_min: number[];
    weather_code: number[];
  };
}

export default function WeatherWidget({ lat, lng, isExpanded = false }: WeatherWidgetProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [cityName, setCityName] = useState("Selected Location");
  const [activeTab, setActiveTab] = useState<"temperature" | "precipitation" | "wind">("temperature");

  const gradientId = useId();

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
          setCoords({ lat: 20.88, lng: 71.40 });
          setCityName("Kovaya, Gujarat (Default)");
        }
      );
    } else {
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
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Weather request failed");
        
        const data = await res.json();
        
        const hourLimit = 24; // fetch 24 hours
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
            time: (data.hourly.time || []).slice(0, hourLimit),
            temperature: (data.hourly.temperature_2m || []).slice(0, hourLimit),
            precipitation_probability: (data.hourly.precipitation_probability || []).slice(0, hourLimit),
            wind_speed: (data.hourly.wind_speed_10m || []).slice(0, hourLimit),
            wind_direction: (data.hourly.wind_direction_10m || []).slice(0, hourLimit),
            weather_code: (data.hourly.weather_code || []).slice(0, hourLimit)
          },
          daily: {
            time: data.daily.time || [],
            temp_max: data.daily.temperature_2m_max || [],
            temp_min: data.daily.temperature_2m_min || [],
            weather_code: data.daily.weather_code || []
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
    let animClass = "";
    if (code === 0 || code === 1) animClass = "weather-anim-sun";
    else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) animClass = "weather-anim-rain";
    else if (code >= 71 && code <= 77) animClass = "weather-anim-snow";
    else if (code >= 95) animClass = "weather-anim-storm";

    if (code === 0) {
      return <Sun className={`${sizeClass} text-amber-400 [.light_&]:text-[#d97706] ${animClass}`} />;
    }
    if (code <= 3) {
      return <CloudSun className={`${sizeClass} text-amber-300 [.light_&]:text-[#b45309] ${animClass}`} />;
    }
    if (code >= 51 && code <= 67) {
      return <CloudRain className={`${sizeClass} text-sky-400 [.light_&]:text-[#0284c7] ${animClass}`} />;
    }
    if (code >= 71 && code <= 77) {
      return <CloudSnow className={`${sizeClass} text-cyan-300 [.light_&]:text-[#0891b2] ${animClass}`} />;
    }
    if (code >= 80 && code <= 82) {
      return <CloudRain className={`${sizeClass} text-blue-400 [.light_&]:text-[#2563eb] ${animClass}`} />;
    }
    if (code >= 95) {
      return <CloudLightning className={`${sizeClass} text-purple-400 [.light_&]:text-[#7c3aed] ${animClass}`} />;
    }
    return <Cloud className={`${sizeClass} text-slate-400 [.light_&]:text-[#64748b]`} />;
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
      <div className="w-full max-w-full p-6 my-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/95 [.light_&]:bg-[#faf9f5] [.light_&]:border-[#e6dfd8] flex flex-col gap-5 animate-pulse select-none">
        <div className="h-6 w-1/3 bg-zinc-800/80 [.light_&]:bg-[#dfd8cc] rounded-lg"></div>
        <div className="flex gap-6 items-center">
          <div className="w-16 h-16 bg-zinc-800/80 [.light_&]:bg-[#dfd8cc] rounded-2xl"></div>
          <div className="flex flex-col gap-2.5 flex-grow">
            <div className="h-10 w-1/4 bg-zinc-800/80 [.light_&]:bg-[#dfd8cc] rounded-lg"></div>
            <div className="h-4 w-1/3 bg-zinc-800/50 [.light_&]:bg-[#e6dfd8] rounded-md"></div>
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg || !weather) {
    return (
      <div className="w-full max-w-full p-6 my-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/95 [.light_&]:bg-[#faf9f5] [.light_&]:border-[#e6dfd8] text-zinc-400 [.light_&]:text-[#6c6a64] text-sm font-sans">
        {errorMsg || "Weather metrics unavailable."}
      </div>
    );
  }

  const currentTemp = Math.round(weather.current.temperature);
  const feelsLike = Math.round(weather.current.apparent_temp);

  // Slice hourly data: 12 items in normal mode, 24 in expanded mode
  const displayedCount = isExpanded ? 24 : 12;
  const hourlyTimes = weather.hourly.time.slice(0, displayedCount);
  const hourlyTemps = weather.hourly.temperature.slice(0, displayedCount);
  const hourlyPrecip = weather.hourly.precipitation_probability.slice(0, displayedCount);
  const hourlyWindSpeed = weather.hourly.wind_speed.slice(0, displayedCount);
  const hourlyWindDir = weather.hourly.wind_direction.slice(0, displayedCount);
  const hourlyCodes = weather.hourly.weather_code.slice(0, displayedCount);

  // Slice daily data: 7 days in all views
  const dailyCount = 7;
  const dailyTimes = weather.daily.time.slice(0, dailyCount);

  // Graph dimensions calculation
  const itemWidth = 64; // width per hourly card
  const svgWidth = displayedCount * itemWidth;
  const svgHeight = 85;

  // Temperature graph points calculation
  const minTemp = Math.min(...hourlyTemps);
  const maxTemp = Math.max(...hourlyTemps);
  const tempRange = maxTemp - minTemp || 1;

  const tempPoints = hourlyTemps.map((temp, idx) => {
    const x = idx * itemWidth + itemWidth / 2;
    // Map Y coordinate (padding top: 22px, padding bottom: 18px)
    const y = 22 + (1 - (temp - minTemp) / tempRange) * (svgHeight - 40);
    return { x, y, temp };
  });

  // Construct SVG smooth Bezier path for Temperature line graph
  const makeSmoothPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];
      const cp1x = curr.x + itemWidth * 0.45;
      const cp1y = curr.y;
      const cp2x = next.x - itemWidth * 0.45;
      const cp2y = next.y;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
    }
    return d;
  };

  const linePath = makeSmoothPath(tempPoints);
  const areaPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return "";
    const line = makeSmoothPath(pts);
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${line} L ${last.x} ${svgHeight} L ${first.x} ${svgHeight} Z`;
  };

  return (
    <div className={`w-full max-w-full my-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/95 [.light_&]:bg-[#faf9f5] [.light_&]:border-[#e6dfd8] p-5 sm:p-7 shadow-2xl [.light_&]:shadow-xl backdrop-blur-md overflow-hidden select-none font-sans relative group ${
      isExpanded ? "max-w-4xl mx-auto my-6 p-6 sm:p-8 space-y-6" : ""
    }`}>
      {/* Decorative gradient blur */}
      <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-blue-500/5 [.light_&]:bg-amber-500/10 rounded-full blur-3xl group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* --- 1. TOP HEADER BAR --- */}
      <div className="flex items-center justify-between gap-3 w-full border-b border-zinc-800/70 [.light_&]:border-[#e6dfd8] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 [.light_&]:bg-[#efe9de] [.light_&]:border-[#c3c2b7] text-zinc-300 [.light_&]:text-[#141413]">
            {getWeatherIcon(weather.current.weather_code, "w-5 h-5")}
          </div>
          <div>
            <h3 className="font-serif text-xl sm:text-2xl md:text-3xl font-normal text-zinc-100 [.light_&]:text-[#141413] tracking-tight capitalize select-text">
              {cityName}
            </h3>
            <span className="text-xs text-zinc-400 [.light_&]:text-[#6c6a64] font-medium">Current Weather Report</span>
          </div>
        </div>

        <span className="text-xs font-mono text-zinc-400 [.light_&]:text-[#6c6a64] bg-zinc-900/60 [.light_&]:bg-[#efe9de] border border-zinc-800/80 [.light_&]:border-[#c3c2b7] px-3 py-1 rounded-full shrink-0">
          Open-Meteo
        </span>
      </div>

      {/* --- 2. HERO TEMPERATURE & KEY METRICS ROW --- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 my-2">
        {/* Main Temperature Hero */}
        <div className="flex items-center gap-4">
          <span className="font-serif text-5xl sm:text-6xl md:text-7xl font-light text-zinc-100 [.light_&]:text-[#141413] tracking-tight">
            {currentTemp}°C
          </span>
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-medium text-zinc-200 [.light_&]:text-[#141413] capitalize">
              {getWeatherDescription(weather.current.weather_code)}
            </span>
            <span className="text-xs text-zinc-400 [.light_&]:text-[#6c6a64]">
              RealFeel {feelsLike}°C
            </span>
          </div>
        </div>

        {/* 3-Stat Quick Metrics Group */}
        <div className="flex items-center gap-3 sm:gap-4 bg-zinc-900/50 [.light_&]:bg-[#efe9de] border border-zinc-800/80 [.light_&]:border-[#c3c2b7] rounded-2xl px-4 py-3 text-xs w-full sm:w-auto justify-around">
          <div className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-zinc-400 [.light_&]:text-[#6c6a64]" />
            <div className="flex flex-col">
              <span className="text-[11px] text-zinc-400 [.light_&]:text-[#6c6a64]">Feels Like</span>
              <span className="font-semibold text-zinc-100 [.light_&]:text-[#141413]">{feelsLike}°C</span>
            </div>
          </div>

          <div className="h-6 w-px bg-zinc-800/80 [.light_&]:bg-[#c3c2b7]" />

          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-zinc-400 [.light_&]:text-[#6c6a64]" />
            <div className="flex flex-col">
              <span className="text-[11px] text-zinc-400 [.light_&]:text-[#6c6a64]">Humidity</span>
              <span className="font-semibold text-zinc-100 [.light_&]:text-[#141413]">{weather.current.humidity}%</span>
            </div>
          </div>

          <div className="h-6 w-px bg-zinc-800/80 [.light_&]:bg-[#c3c2b7]" />

          <div className="flex items-center gap-2">
            <WindIcon className="w-4 h-4 text-zinc-400 [.light_&]:text-[#6c6a64]" />
            <div className="flex flex-col">
              <span className="text-[11px] text-zinc-400 [.light_&]:text-[#6c6a64]">Wind</span>
              <span className="font-semibold text-zinc-100 [.light_&]:text-[#141413]">{weather.current.wind_speed} km/h</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- 3. INTERACTIVE METRIC TABS & GRAPH HOURLY SECTION --- */}
      <div className="flex flex-col gap-3 mt-4 bg-zinc-900/40 [.light_&]:bg-[#efe9de] border border-zinc-800/80 [.light_&]:border-[#c3c2b7] rounded-2xl p-4 sm:p-5">
        {/* Tab Selector Buttons */}
        <div className="flex items-center gap-6 border-b border-zinc-800/70 [.light_&]:border-[#c3c2b7] pb-3 text-xs sm:text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("temperature")}
            className={`pb-1 transition-all cursor-pointer relative ${
              activeTab === "temperature"
                ? "text-amber-400 [.light_&]:text-[#d97706] font-semibold"
                : "text-zinc-400 [.light_&]:text-[#6c6a64] hover:text-zinc-200 [.light_&]:hover:text-[#141413]"
            }`}
          >
            Temperature
            {activeTab === "temperature" && (
              <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-amber-400 [.light_&]:bg-[#d97706] rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("precipitation")}
            className={`pb-1 transition-all cursor-pointer relative ${
              activeTab === "precipitation"
                ? "text-sky-400 [.light_&]:text-[#0284c7] font-semibold"
                : "text-zinc-400 [.light_&]:text-[#6c6a64] hover:text-zinc-200 [.light_&]:hover:text-[#141413]"
            }`}
          >
            Precipitation
            {activeTab === "precipitation" && (
              <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-sky-400 [.light_&]:bg-[#0284c7] rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("wind")}
            className={`pb-1 transition-all cursor-pointer relative ${
              activeTab === "wind"
                ? "text-teal-400 [.light_&]:text-[#0f766e] font-semibold"
                : "text-zinc-400 [.light_&]:text-[#6c6a64] hover:text-zinc-200 [.light_&]:hover:text-[#141413]"
            }`}
          >
            Wind
            {activeTab === "wind" && (
              <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-teal-400 [.light_&]:bg-[#0f766e] rounded-full" />
            )}
          </button>
        </div>

        {/* Dynamic SVG Trend Graph Container */}
        <div className="overflow-x-auto custom-scrollbar pt-2 pb-1">
          <div style={{ width: `${svgWidth}px` }} className="relative flex flex-col">
            
            {/* --- SVG Visualization Stage --- */}
            <div className="h-[90px] w-full relative">
              {activeTab === "temperature" && (
                <svg width={svgWidth} height={svgHeight} className="overflow-visible">
                  <defs>
                    <linearGradient id={`${gradientId}-temp-dark`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.30" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id={`${gradientId}-temp-light`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d97706" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#d97706" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Gradient Area Fill — Dark Mode */}
                  <path
                    d={areaPath(tempPoints)}
                    fill={`url(#${gradientId}-temp-dark)`}
                    className="[.light_&]:hidden"
                  />

                  {/* Gradient Area Fill — Light Mode */}
                  <path
                    d={areaPath(tempPoints)}
                    fill={`url(#${gradientId}-temp-light)`}
                    className="hidden [.light_&]:block"
                  />

                  {/* Bezier Line Stroke */}
                  <path
                    d={linePath}
                    fill="none"
                    strokeWidth="2.5"
                    className="stroke-amber-400 [.light_&]:stroke-[#d97706]"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Data Point Circles & Temperature Numerical Labels */}
                  {tempPoints.map((pt, idx) => (
                    <g key={idx}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="3.5"
                        className="fill-amber-400 [.light_&]:fill-[#d97706] stroke-zinc-950 [.light_&]:stroke-[#faf9f5]"
                        strokeWidth="1.5"
                      />
                      <text
                        x={pt.x}
                        y={pt.y - 8}
                        textAnchor="middle"
                        className="text-[11px] font-mono font-semibold fill-zinc-200 [.light_&]:fill-[#141413]"
                      >
                        {pt.temp}°
                      </text>
                    </g>
                  ))}
                </svg>
              )}

              {activeTab === "precipitation" && (
                <svg width={svgWidth} height={svgHeight} className="overflow-visible">
                  {hourlyPrecip.map((prob, idx) => {
                    const x = idx * itemWidth + (itemWidth - 24) / 2;
                    const barHeight = Math.max((prob / 100) * 52, prob > 0 ? 4 : 2);
                    const y = svgHeight - barHeight;
                    return (
                      <g key={idx}>
                        <rect
                          x={x}
                          y={y}
                          width="24"
                          height={barHeight}
                          rx="4"
                          className="fill-sky-400/80 [.light_&]:fill-[#0284c7]/80"
                        />
                        <text
                          x={x + 12}
                          y={y - 6}
                          textAnchor="middle"
                          className="text-[10.5px] font-mono font-semibold fill-sky-300 [.light_&]:fill-[#0284c7]"
                        >
                          {prob}%
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}

              {activeTab === "wind" && (
                <div style={{ width: `${svgWidth}px` }} className="flex h-full items-end pb-2">
                  {hourlyWindSpeed.map((speed, idx) => {
                    const dir = hourlyWindDir[idx] || 0;
                    return (
                      <div
                        key={idx}
                        style={{ width: `${itemWidth}px` }}
                        className="flex flex-col items-center justify-end gap-1.5 shrink-0"
                      >
                        <span className="text-[10.5px] font-mono font-semibold text-teal-300 [.light_&]:text-[#0f766e]">
                          {Math.round(speed)} km/h
                        </span>
                        <div
                          style={{ transform: `rotate(${dir}deg)` }}
                          className="p-1 rounded-full bg-teal-500/10 [.light_&]:bg-[#0f766e]/10 text-teal-400 [.light_&]:text-[#0f766e] transition-transform duration-300"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* --- Hourly Cards Bottom Row --- */}
            <div className="flex w-full pt-3 border-t border-zinc-800/60 [.light_&]:border-[#c3c2b7]">
              {hourlyTimes.map((timeStr, idx) => {
                const date = new Date(timeStr);
                const hour = date.getHours();
                const ampm = hour >= 12 ? "PM" : "AM";
                const hourLabel = `${hour % 12 || 12} ${ampm}`;
                const code = hourlyCodes[idx];

                return (
                  <div
                    key={idx}
                    style={{ width: `${itemWidth}px` }}
                    className="flex flex-col items-center gap-1.5 shrink-0 text-center"
                  >
                    <span className="text-[11px] text-zinc-400 [.light_&]:text-[#6c6a64] font-medium">{hourLabel}</span>
                    {getWeatherIcon(code, "w-4.5 h-4.5")}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* --- 4. MULTI-DAY FORECAST SECTION --- */}
      <div className="flex flex-col gap-3 mt-4">
        <div className="flex items-center gap-2 text-zinc-400 [.light_&]:text-[#6c6a64]">
          <Calendar className="w-4 h-4" />
          <span className="text-xs font-medium tracking-wider uppercase">
            7-Day Forecast
          </span>
        </div>

        <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
          {dailyTimes.map((dayStr, idx) => {
            const date = new Date(dayStr);
            const today = new Date().toDateString();
            const dayLabel = date.toDateString() === today 
              ? "Today" 
              : date.toLocaleDateString("en-US", { weekday: "short" });
            const maxTemp = Math.round(weather.daily.temp_max[idx]);
            const minTemp = Math.round(weather.daily.temp_min[idx]);
            const code = weather.daily.weather_code[idx];

            return (
              <div 
                key={idx} 
                className="flex items-center justify-between bg-zinc-900/40 [.light_&]:bg-[#efe9de] border border-zinc-800/70 [.light_&]:border-[#c3c2b7] px-4 py-3 rounded-xl text-xs sm:text-sm"
              >
                <span className="w-20 font-medium text-zinc-200 [.light_&]:text-[#141413] shrink-0">{dayLabel}</span>
                <div className="flex items-center gap-2.5 flex-1 justify-start px-2 min-w-0">
                  {getWeatherIcon(code, "w-4.5 h-4.5 shrink-0")}
                  <span className="text-xs text-zinc-400 [.light_&]:text-[#6c6a64] truncate">
                    {getWeatherDescription(code)}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                  <span className="font-semibold text-zinc-100 [.light_&]:text-[#141413]">{maxTemp}°</span>
                  <span className="text-zinc-500 [.light_&]:text-[#8e8b82]">/</span>
                  <span className="font-medium text-zinc-400 [.light_&]:text-[#6c6a64]">{minTemp}°</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Embedded Weather CSS Animations & Custom Scrollbar */}
      <style jsx>{`
        @keyframes rainPulse {
          0%, 100% { transform: translateY(0px); opacity: 0.85; }
          50% { transform: translateY(3px); opacity: 1; }
        }
        @keyframes sunShimmer {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.9; }
          50% { transform: scale(1.06) rotate(3deg); opacity: 1; }
        }
        @keyframes snowDrift {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(2px) translateX(2px); }
        }
        @keyframes stormPulse {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }
        .weather-anim-rain { animation: rainPulse 2s ease-in-out infinite; }
        .weather-anim-sun { animation: sunShimmer 6s ease-in-out infinite; }
        .weather-anim-snow { animation: snowDrift 4s ease-in-out infinite; }
        .weather-anim-storm { animation: stormPulse 3s ease-in-out infinite; }

        .custom-scrollbar::-webkit-scrollbar {
          height: 5px;
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 9999px;
        }
        :global(.light) .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #c3c2b7;
        }
      `}</style>
    </div>
  );
}
