# Audio Transcription

Audio transcription application using ElevenLabs API.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file and add your ElevenLabs API key:
```bash
cp .env.example .env
# Then edit .env and add your API key
```

3. Start the server:
```bash
npm start
```

4. Open `index.html` in your browser (or navigate to `http://localhost:3000`)

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

## Troubleshooting

- If you get a timeout error, the file may be very large - wait longer or try a shorter file
- For very long files (>30 minutes), processing may take 10-20 minutes
- Make sure the server is running before uploading files

