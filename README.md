# 🎬 Video Downloader Hub

> **Universal downloader for YouTube, Instagram & more**
> Clean UI • Fast backend • Zero‑bloat codebase

![License](https://img.shields.io/github/license/myexistences/video-downloader-hub?style=flat-square)
![Issues](https://img.shields.io/github/issues/myexistences/video-downloader-hub?style=flat-square)
![Stars](https://img.shields.io/github/stars/myexistences/video-downloader-hub?style=flat-square)

---

## ✨ Features

| Capability                     | Python `server.py` | Node `server.js` |
| ------------------------------ | ------------------ | ---------------- |
| YouTube video / audio download | ✅                  | ✅                |
| Instagram Reels / Post / Story | ✅                  | ✅                |
| MP4 / MP3 conversion (ffmpeg)  | ✅                  | ✅                |
| JSON API for programmatic use  | ✅                  | ✅                |
| Config‑free HTTP server        | ✅                  | ✅                |

---

## 📂 Project Layout

```
video-downloader-hub/
├── client/               # Front-end UI (HTML/CSS/JS)
│   ├── index.html        # Main HTML file
│   ├── script.js         # Front-end logic (XHR/API calls, etc.)
│   └── styles.css        # Styling for the front-end
├── server/               # Back-end API implementations
│   ├── server.py         # Python Flask server using yt-dlp
│   ├── server.js         # Node.js Express server using ytdl-core
│   ├── package.json      # Node.js dependencies and scripts
│   └── requirements.txt  # Python dependencies
├── downloads/            # Temporary folder for downloaded videos (auto-cleaned)
└── README.md             # Project overview and instructions

```

---

## 🚀 Quick Start

### 1. Clone & enter the repo

```bash
$ git clone https://github.com/myexistences/video-downloader-hub.git
$ cd video-downloader-hub/server
```

### 2. Choose your backend

| Stack                              | When to choose                                                   | Startup command                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Python 3.10+** (Flask + yt‑dlp)  | You already have Python or want the fastest updates from yt‑dlp  | `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && python server.py` |
| **Node 20+** (Express + ytdl‑core) | You prefer JavaScript everywhere or need SSR on the same runtime | `npm i && npm run dev`                                                                                      |

> **Tip:** Both servers expose identical REST endpoints on **`http://localhost:3001`** so you can swap without touching the front‑end.

---

## 🐍 Running the Python server

```bash
# inside /server
pip install -r requirements.txt   # Flask, yt‑dlp, flask‑cors, etc.
python server.py                  # starts on http://localhost:3001
```

Python‑specific environment variables (optional):

| Variable        | Default  | Description               |
| --------------- | -------- | ------------------------- |
| `PORT`          | `3001`   | Change listening port     |
| `FFMPEG_BINARY` | `ffmpeg` | Path to ffmpeg executable |

---

## 🟢 Running the Node server

```bash
# inside /server
npm install          # installs ytdl-core, express, cors, etc.
npm run dev          # nodemon, hot reload
# or
npm start            # production mode
```

`package.json` ships with:

```json
{
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js"
  }
}
```

Node‑specific environment variables (optional):

| Variable   | Default       | Description                      |
| ---------- | ------------- | -------------------------------- |
| `PORT`     | `3001`        | Change listening port            |
| `TEMP_DIR` | `./downloads` | Where temporary files are cached |

---

## 🔌 API Reference

```
GET /api/youtube/info?url=<video‑url>
  → 200 OK  { title, thumbnail, duration, author, formats[] }

GET /api/youtube/download?url=<video‑url>&itag=<format‑id>&type=<video|audio>
  → attachment  (MP4 / MP3)
```

### Example

```bash
curl "http://localhost:3001/api/youtube/info?url=https://youtu.be/dQw4w9WgXcQ"
```

---

## ⚙️ Prerequisites

* **Python ≥ 3.10** **or** **Node.js ≥ 20**
* **ffmpeg** in your `PATH` (for MP3/MP4 merging)
* *Optional:* Docker (see `docker-compose.yml`, coming soon)

---

## 🐳 Docker (one‑liner)

```bash
docker run --rm -p 3001:3001 ghcr.io/myexistences/video-downloader-hub:latest
```

---

## 📝 Logging & Troubleshooting

* All requests are logged with timestamps in **`server/debug.log`**.
* Temporary files are cleaned automatically 1 hour after creation.
* Set `LOG_LEVEL=DEBUG` for verbose output.

---

## 🤝 Contributing

Pull requests are welcome!
1. Fork → 2. Create feature branch → 3. Commit → 4. Open PR.

---

## ⚖️ License

Released under the **MIT License**.  See [LICENSE](LICENSE) for details.

> **Disclaimer**
> This project is provided for educational and personal‑backup purposes **only**.  Downloading copyrighted content without permission may violate the Terms of Service of YouTube, Instagram, or other platforms, and could be illegal in your jurisdiction.
