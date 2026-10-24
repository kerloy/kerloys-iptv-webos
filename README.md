# Kerloy's IPTV for LG webOS TV (`kerloys-iptv-webos`)

A cinema-grade IPTV application built for **LG webOS Smart TVs (2020 / webOS 5.x through webOS 24/25)** supporting **Xtream Codes**, **Standard M3U/M3U8 Playlists**, **Multi-Track Audio & Video Stream Selection**, and **In-Player Subtitle Search, Download & Sync (OpenSubtitles.com + SubDL + Local/URL `.srt`/`.vtt`)**.

---

## ✨ Key Features

- **Xtream Codes & M3U Multi-Profile Support**:
  - Connect unlimited **Xtream Codes** servers (automatically separates **Live TV**, **Movies/VOD**, and **TV Series** with Seasons & Episodes + EPG).
  - Load **M3U / M3U8 Playlists** via URL, local USB file upload, or pasted `#EXTM3U` text with automatic `SxxExx` series episode grouping.
  - Built-in **4K Multi-Track Demo Showcase** profile so you can test every feature out of the box.
- **Audio & Video Stream Selector (Yellow Remote Button `405`)**:
  - Switch between multiple **Audio Streams** (e.g., Stereo, 5.1 Surround, multi-language tracks, Commentary) via `hls.js` MSE and native webOS `video.audioTracks`.
  - Switch between **Video Streams / Bitrate Levels** (Auto ABR, 4K, 1080p, 720p, 480p), screen **Aspect Ratios** (`Fit`, `Fill`, `16:9`, `4:3`), and **Decoder Pipelines** (`Auto Hybrid`, `HLS.js MSE`, `webOS Native Hardware`).
- **Complete Subtitle System (Blue Remote Button `406`)**:
  - Switch **Embedded Subtitles** (`HLS` / `MP4` / `MKV` text tracks).
  - **Search & Download Subtitles on the TV**: Integrated **OpenSubtitles.com REST API** and **SubDL API** client to download `.srt` / `.zip` subtitles directly inside the player and attach them immediately.
  - **Custom Subtitle Loader**: Load `.srt` or `.vtt` files from a USB flash drive plugged into the TV or via direct URL.
  - **Live Subtitle Timing Sync (`±0.1s` / `±0.5s`)**: Shift subtitles earlier or later in real time and customize font size and color.
- **Instant Global Search (Green Remote Button `404`)**:
  - High-speed multi-facet search across Live TV, Movies, and Series with an on-screen D-Pad virtual keyboard, rating filters, and Favorites filter.
- **Parental Controls, Favorites & Resume Playback**:
  - 4-digit PIN lock (`0000` default) for adult/18+ categories and channels.
  - Automatic playback position saving (`Continue Watching`) for Movies and Series episodes.

---

## 🚀 Quick Start (No Physical TV Required!)

### 1. Run in Browser / 1080p TV Dev Mode on Your Mac
```bash
npm install
npm run dev
```
Open `http://localhost:5173`. A built-in CORS proxy middleware (`/__proxy`) in `vite.config.ts` allows your browser to connect to any Xtream Codes or M3U server without CORS restrictions.

### 2. Run in the Official LG webOS TV Simulator (macOS)
1. Download the free **LG webOS TV Simulator** (e.g., webOS 5.0 or webOS 24) from [webostv.developer.lge.com/develop/tools/simulator-introduction](https://webostv.developer.lge.com/develop/tools/simulator-introduction).
2. Build the production bundle and launch it in the simulator:
```bash
npm run build
npx ares-launch -s 5 ./dist
```

### 3. Package & Install on Your Real 2020+ LG webOS 5.x TV
1. On your LG TV, open the **LG Content Store**, install the **Developer Mode** app, log in with your free LG Developer account, enable **Dev Mode Status: ON** (TV will reboot), and enable **Key Server: ON**.
2. Pair your Mac with the TV on the same Wi-Fi/LAN network:
```bash
npm run setup:tv
npx ares-novacom --device <your-tv-name> --getkey
```
3. Build the `.ipk` package and install it onto your TV:
```bash
npm run build:ipk
npm run deploy:tv
npm run launch:tv
```
The packaged installer is generated at `./release/com.kerloy.iptv_1.0.0_all.ipk`.

---

## 🎮 LG webOS Remote Shortcuts

| Button | KeyCode | Action |
| :--- | :--- | :--- |
| **Arrow Keys / D-Pad** | `37–40` | Spatial navigation & `-15s / +15s` seek in player |
| **OK / Wheel Click** | `13` | Select / Toggle Play & Pause |
| **BACK** | `461` / `Esc` | Close Modal / Exit Player / Return to Home |
| **CH ▲ / ▼** | `33 / 34` | Zap Live TV Channels Up / Down |
| **● RED Button** | `403` | Toggle Favorite |
| **● GREEN Button** | `404` | Open Global Search |
| **● YELLOW Button** | `405` | Open Audio & Video Stream Selector |
| **● BLUE Button** | `406` | Open Subtitle Search, Download & Sync Modal |

---

## 🧪 Testing & Verification

```bash
# Run unit tests (M3U parser, Xtream client, SRT-to-VTT & timing sync, Search engine)
npm run test

# Build Chromium 68 (webOS 5.x) production bundle and package .ipk
npm run build:ipk
```
