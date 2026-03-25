import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, RefreshCw, Trash2 } from "lucide-react";
import "./App.css";

const DEFAULT_CITIES = ["İstanbul", "Ankara", "İzmir"];

const weatherCodeMap = {
  0: { text: "Açık", emoji: "☀️" },
  1: { text: "Az bulutlu", emoji: "🌤️" },
  2: { text: "Parçalı bulutlu", emoji: "⛅" },
  3: { text: "Bulutlu", emoji: "☁️" },
  45: { text: "Sisli", emoji: "🌫️" },
  48: { text: "Kırağı sisli", emoji: "🌫️" },
  51: { text: "Hafif çisenti", emoji: "🌦️" },
  53: { text: "Çisenti", emoji: "🌦️" },
  55: { text: "Yoğun çisenti", emoji: "🌧️" },
  61: { text: "Hafif yağmur", emoji: "🌦️" },
  63: { text: "Yağmur", emoji: "🌧️" },
  65: { text: "Kuvvetli yağmur", emoji: "🌧️" },
  71: { text: "Hafif kar", emoji: "🌨️" },
  73: { text: "Kar", emoji: "❄️" },
  75: { text: "Yoğun kar", emoji: "❄️" },
  80: { text: "Sağanak", emoji: "🌧️" },
  81: { text: "Kuvvetli sağanak", emoji: "⛈️" },
  82: { text: "Şiddetli sağanak", emoji: "⛈️" },
  95: { text: "Fırtına", emoji: "⛈️" },
};

function getWeatherMeta(code) {
  return weatherCodeMap[code] || { text: "Bilinmiyor", emoji: "🌍" };
}

function getBgClass(code) {
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75].includes(code)) return "snow";
  if ([95].includes(code)) return "storm";
  if ([1, 2, 3, 45, 48].includes(code)) return "cloud";
  return "sun";
}

async function fetchCityCoordinates(city) {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=tr&format=json`
  );
  const data = await res.json();
  if (!data.results?.length) throw new Error("Şehir bulunamadı");
  return data.results[0];
}

async function fetchWeather(lat, lon) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`
  );
  return res.json();
}

function WeatherCard({ item, onRemove, onRefresh }) {
  const meta = getWeatherMeta(item.current.weather_code);

  return (
    <motion.div
      className={`weather-card ${getBgClass(item.current.weather_code)}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="card-actions">
        <button onClick={() => onRefresh(item.query)} title="Yenile">
          <RefreshCw size={16} />
        </button>
        <button onClick={() => onRemove(item.id)} title="Sil">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="emoji">{meta.emoji}</div>
      <h2>{item.city}</h2>
      <div className="country">{item.country}</div>
      <div className="status">{meta.text}</div>
      <div className="temp">{Math.round(item.current.temperature_2m)}°C</div>
      <div className="feels">
        Hissedilen: {Math.round(item.current.apparent_temperature)}°C
      </div>

      <div className="stats">
        <div className="stat-box">
          <span>Rüzgar</span>
          <strong>{Math.round(item.current.wind_speed_10m)} km/sa</strong>
        </div>
        <div className="stat-box">
          <span>Nem</span>
          <strong>%{Math.round(item.current.relative_humidity_2m)}</strong>
        </div>
      </div>

      <div className="forecast">
        {item.daily.time.map((date, i) => {
          const dayMeta = getWeatherMeta(item.daily.weather_code[i]);
          return (
            <div className="day-box" key={date}>
              <div>{new Date(date).toLocaleDateString("tr-TR", { weekday: "short" })}</div>
              <div className="day-emoji">{dayMeta.emoji}</div>
              <div>{Math.round(item.daily.temperature_2m_max[i])}°</div>
              <small>{Math.round(item.daily.temperature_2m_min[i])}°</small>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default function App() {
  const [cityInput, setCityInput] = useState("");
  const [cities, setCities] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("weather-cities");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length) {
        setCities(parsed);
        return;
      }
    }

    DEFAULT_CITIES.forEach((city, i) => {
      setTimeout(() => addCity(city), 150 * (i + 1));
    });
  }, []);

  useEffect(() => {
    localStorage.setItem("weather-cities", JSON.stringify(cities));
  }, [cities]);

  async function addCity(cityNameArg) {
    const cityName = (cityNameArg ?? cityInput).trim();
    if (!cityName) return;

    const exists = cities.some(
      (item) => item.query.toLowerCase() === cityName.toLowerCase()
    );
    if (exists) {
      setMessage("Bu şehir zaten ekli.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const place = await fetchCityCoordinates(cityName);
      const weather = await fetchWeather(place.latitude, place.longitude);

      const newItem = {
        id: `${place.name}-${Date.now()}`,
        query: cityName,
        city: place.name,
        country: place.country || "",
        latitude: place.latitude,
        longitude: place.longitude,
        current: weather.current,
        daily: weather.daily,
      };

      setCities((prev) => [newItem, ...prev]);
      setCityInput("");
    } catch (err) {
      setMessage(err.message || "Veri alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshCity(query) {
    const target = cities.find((c) => c.query === query);
    if (!target) return;

    try {
      const weather = await fetchWeather(target.latitude, target.longitude);
      setCities((prev) =>
        prev.map((item) =>
          item.query === query
            ? { ...item, current: weather.current, daily: weather.daily }
            : item
        )
      );
    } catch {
      setMessage("Yenileme sırasında hata oluştu.");
    }
  }

  function removeCity(id) {
    setCities((prev) => prev.filter((item) => item.id !== id));
  }

  function clearAll() {
    setCities([]);
    localStorage.removeItem("weather-cities");
  }

  function addCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage("Konum özelliği desteklenmiyor.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          setLoading(true);
          const { latitude, longitude } = position.coords;
          const weather = await fetchWeather(latitude, longitude);

          setCities((prev) => {
            const filtered = prev.filter((x) => x.query !== "Konumum");
            return [
              {
                id: `Konumum-${Date.now()}`,
                query: "Konumum",
                city: "Konumum",
                country: "Canlı Konum",
                latitude,
                longitude,
                current: weather.current,
                daily: weather.daily,
              },
              ...filtered,
            ];
          });
          setMessage("");
        } catch {
          setMessage("Konum hava durumu alınamadı.");
        } finally {
          setLoading(false);
        }
      },
      () => setMessage("Konum izni verilmedi.")
    );
  }

  return (
    <div className="app">
      <div className="container">
        <header className="hero">
          <div>
            <p className="eyebrow">React Hava Durumu</p>
            <h1>Şehir şehir gelişmiş hava takibi</h1>
            <p className="subtitle">
              Çoklu şehir ekle, anlık verileri gör, 5 günlük tahmini incele.
            </p>
          </div>

          <div className="controls">
            <div className="input-row">
              <input
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCity()}
                placeholder="Şehir yaz..."
              />
              <button className="primary" onClick={() => addCity()}>
                Ekle
              </button>
            </div>

            <div className="button-row">
              <button onClick={addCurrentLocation}>
                <MapPin size={16} /> Konumum
              </button>
              <button onClick={clearAll}>Hepsini Temizle</button>
            </div>

            {(loading || message) && (
              <div className="message">{loading ? "Yükleniyor..." : message}</div>
            )}
          </div>
        </header>

        {cities.length === 0 ? (
          <div className="empty">Henüz şehir eklenmedi.</div>
        ) : (
          <div className="grid">
            {cities.map((item) => (
              <WeatherCard
                key={item.id}
                item={item}
                onRemove={removeCity}
                onRefresh={refreshCity}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}