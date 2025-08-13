// Replace with your OpenWeatherMap API key
const API_KEY = "7cc6c0d1a91cd5abbe3fc07095713e51";
const BASE = "https://api.openweathermap.org/data/2.5";

let currentUnit = "metric"; // 'metric' = °C, 'imperial' = °F
let lastData = null; // to store last weather data


const els = {
  form: document.getElementById("search-form"),
  input: document.getElementById("city-input"),
  locBtn: document.getElementById("loc-btn"),
  card: document.getElementById("card"),
  place: document.getElementById("place-name"),
  time: document.getElementById("updated-time"),
  icon: document.getElementById("icon"),
  temp: document.getElementById("temp"),
  desc: document.getElementById("desc"),
  feels: document.getElementById("feels"),
  tmin: document.getElementById("tmin"),
  tmax: document.getElementById("tmax"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  pressure: document.getElementById("pressure"),
  status: document.getElementById("status"),
  spinner: document.getElementById("spinner"),
};

function showSpinner(show) {
  els.spinner.classList.toggle("hidden", !show);
}
function setStatus(msg = "") {
  els.status.textContent = msg;
}
function showCard(show) {
  els.card.classList.toggle("hidden", !show);
}

function iconUrl(code) {
  // openweathermap icon set
  return `https://openweathermap.org/img/wn/${code}@2x.png`;
}

function fmtLocalTime(dt, tzSeconds) {
  // dt is UTC seconds, tzSeconds is offset in seconds
  const ms = (dt + tzSeconds) * 1000;
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "2-digit",
  });
}

function setBgByTemp(t) {
  // Subtle background hue shift by temperature
  const clamped = Math.max(-10, Math.min(40, t));      // -10..40
  const pct = (clamped + 10) / 50;                     // 0..1
  const hue = 220 - Math.floor(pct * 160);             // blue → orange
  document.body.style.background =
    `radial-gradient(1200px 800px at 10% 10%, hsl(${hue} 40% 24%), #0f1221) no-repeat fixed`;
}

async function fetchWeatherByCity(city) {
  const url = `${BASE}/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;
  return fetchJson(url);
}

async function fetchWeatherByCoords(lat, lon) {
  const url = `${BASE}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
  return fetchJson(url);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} • ${text}`);
  }
  return res.json();
}

function render(data) {
  lastData = data; // store so we can re-render on unit change
  const { name, sys, weather, main, wind, dt, timezone } = data;
  const w = weather?.[0];

  const unitSymbol = currentUnit === "metric" ? "°C" : "°F";
  els.place.textContent = `${name || "—"}, ${sys?.country || ""}`.replace(/, $/, "");
  els.time.textContent = `Updated ${fmtLocalTime(dt, timezone)}`;
  els.icon.src = w ? iconUrl(w.icon) : "";
  els.icon.alt = w ? w.description : "Weather icon";
  els.temp.textContent = Math.round(main.temp);
  els.desc.textContent = w ? w.description : "—";
  els.feels.textContent = `${Math.round(main.feels_like)}${unitSymbol}`;
  els.tmin.textContent = `${Math.round(main.temp_min)}${unitSymbol}`;
  els.tmax.textContent = `${Math.round(main.temp_max)}${unitSymbol}`;
  els.humidity.textContent = `${main.humidity}%`;
  els.wind.textContent = `${wind.speed} ${currentUnit === "metric" ? "m/s" : "mph"}`;
  els.pressure.textContent = `${main.pressure} hPa`;

  setBgByTemp(main.temp);
  showCard(true);
}


async function loadByCity(city) {
  try {
    setStatus("");
    showSpinner(true);
    const [current, forecast] = await Promise.all([
      fetchWeatherByCity(city),
      fetchForecastByCity(city)
    ]);
    localStorage.setItem("lastCity", current.name || city);
    render(current);
    renderForecast(forecast);
  } catch (err) {
    console.error(err);
    showCard(false);
    document.getElementById("forecast").classList.add("hidden");
    if (String(err).includes("404")) {
      setStatus("City not found. Check spelling and try again.");
    } else if (String(err).includes("401")) {
      setStatus("Invalid API key. Verify your OpenWeatherMap API key in app.js.");
    } else {
      setStatus("Could not fetch weather. Please try again.");
    }
  } finally {
    showSpinner(false);
  }
}


async function loadByGeolocation() {
  if (!("geolocation" in navigator)) {
    setStatus("Geolocation not supported by your browser.");
    return;
  }
  setStatus("Getting your location…");
  showSpinner(true);
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const { latitude, longitude } = pos.coords;
      const data = await fetchWeatherByCoords(latitude, longitude);
      localStorage.setItem("lastCity", data.name || "");
      render(data);
      setStatus("");
    } catch (err) {
      console.error(err);
      showCard(false);
      setStatus("Could not fetch weather for your location.");
    } finally {
      showSpinner(false);
    }
  }, (err) => {
    console.warn(err);
    showSpinner(false);
    setStatus("Permission denied or location unavailable. Use city search instead.");
  }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
}

// events
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = els.input.value.trim();
  if (!q) return;
  loadByCity(q);
});

els.locBtn.addEventListener("click", () => {
  loadByGeolocation();
});

// initial load: try last city, else geolocation
window.addEventListener("DOMContentLoaded", () => {
  const last = localStorage.getItem("lastCity");
  if (last) {
    loadByCity(last);
  } else {
    loadByGeolocation();
  }
});
document.getElementById("unit-toggle").addEventListener("click", () => {
  currentUnit = currentUnit === "metric" ? "imperial" : "metric";
  document.getElementById("unit-toggle").textContent = currentUnit === "metric" ? "Switch to °F" : "Switch to °C";
  if (lastData) {
    loadByCity(lastData.name);
  }
});
async function fetchForecastByCity(city) {
  const url = `${BASE}/forecast?q=${encodeURIComponent(city)}&units=${currentUnit}&appid=${API_KEY}`;
  return fetchJson(url);
}
function renderForecast(data) {
  const grid = document.getElementById("forecast-grid");
  grid.innerHTML = "";

  // Filter every 24h at 12:00:00
  const daily = data.list.filter(item => item.dt_txt.includes("12:00:00"));

  daily.forEach(day => {
    const date = new Date((day.dt + data.city.timezone) * 1000);
    const temp = Math.round(day.main.temp);
    const icon = iconUrl(day.weather[0].icon);
    const desc = day.weather[0].description;
    const unitSymbol = currentUnit === "metric" ? "°C" : "°F";

    const el = document.createElement("div");
    el.className = "forecast-day";
    el.innerHTML = `
      <div>${date.toLocaleDateString(undefined, { weekday: "short" })}</div>
      <img src="${icon}" alt="${desc}" />
      <div>${temp}${unitSymbol}</div>
      <small class="subtle">${desc}</small>
    `;
    grid.appendChild(el);
  });

  document.getElementById("forecast").classList.remove("hidden");
}

