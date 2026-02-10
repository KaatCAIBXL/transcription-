# Audio Transcription

Audio transcription application using ElevenLabs API.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file and add your ElevenLabs API key:
```bash
# Windows:
copy .env.example .env

# Mac/Linux:
cp .env.example .env
```
Then edit `.env` and set your `ELEVENLABS_API_KEY`.

3. Start the server:
```bash
npm start
```

4. Open **http://localhost:3000** in your browser (don't open `index.html` via file:// — the app needs the server running).

## Usage

1. Click "Choose File" and select an audio file
2. Click "Transcribe"
3. Wait for the transcription
4. Click "Download Transcription" to save as .txt file

## File Size Limits

- **Maximum file size**: 500MB
- **Long audio files**: The app supports audio files up to 1 hour or longer
- **Processing time**: Longer files take more time to transcribe (several minutes for 1-hour audio)
- **Note**: Speaker diarization (identifying who is speaking) works best for audio under 8 minutes, but transcription itself works for longer files

## Deploy (online laten draaien)

**GitHub zelf draait geen Node.js-server** — het bewaart alleen je code. Om de app op een eigen URL te laten draaien (zodat je geen `npm start` lokaal hoeft te doen), deploy je naar een host die Node ondersteunt.

### Via Railway (gratis tier)

1. Ga naar [railway.app](https://railway.app) en log in met GitHub.
2. "New Project" → "Deploy from GitHub repo" → kies deze repo.
3. In het project: **Variables** → voeg toe: `ELEVENLABS_API_KEY` = jouw API key.
4. Deploy start automatisch. Klik op de gegenereerde URL (bijv. `https://audio-transcription-production-xxx.up.railway.app`).

### Via Render

1. Ga naar [render.com](https://render.com) en log in met GitHub.
2. "New" → "Web Service" → kies deze repo.
3. Build: `npm install`, Start: `npm start`.
4. Bij "Environment Variables": voeg `ELEVENLABS_API_KEY` toe.
5. De service krijgt een URL zoals `https://jouw-app.onrender.com`.

Na deploy gebruik je die URL in de browser; de app praat daar automatisch met dezelfde server (relatieve `/api/...`-aanroepen).

## Troubleshooting

- If you get a timeout error, the file may be very large - wait longer or try a shorter file
- For very long files (>30 minutes), processing may take 10-20 minutes
- Make sure the server is running before uploading files

