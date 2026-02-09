import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from 'dotenv';
import { Blob } from 'buffer';

dotenv.config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static('.'));

const upload = multer({ storage: multer.memoryStorage() });

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY
});

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Create a Blob from the buffer
    const audioBlob = new Blob([req.file.buffer], { 
      type: req.file.mimetype || 'audio/mpeg' 
    });

    const transcription = await elevenlabs.speechToText.convert({
      file: audioBlob,
      modelId: "scribe_v2",
      tagAudioEvents: true,
      languageCode: "eng",
      diarize: true,
    });

    // Extract text from transcription response
    const transcriptionText = transcription.text || 
                              (typeof transcription === 'string' ? transcription : JSON.stringify(transcription));
    
    res.json({ transcription: transcriptionText });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: error.message || 'Transcription failed' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
