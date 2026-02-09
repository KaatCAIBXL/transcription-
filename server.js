import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from 'dotenv';
import { Blob } from 'buffer';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Set ffmpeg and ffprobe paths
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

dotenv.config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static('.'));

// Increase limits for large audio files (up to 500MB)
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Configure multer for large files
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  }
});

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY
});

// Store transcription sessions
const sessions = new Map();

// Get audio duration helper
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration);
    });
  });
}

// Split audio into chunks
function splitAudio(inputPath, chunkDuration = 300) { // 5 minutes = 300 seconds
  return new Promise((resolve, reject) => {
    getAudioDuration(inputPath).then(duration => {
      const chunks = [];
      const totalChunks = Math.ceil(duration / chunkDuration);
      
      let currentChunk = 0;
      const chunkPromises = [];
      
      for (let i = 0; i < totalChunks; i++) {
        const startTime = i * chunkDuration;
        const outputPath = join(tmpdir(), `chunk_${uuidv4()}_${i}.mp3`);
        
        const promise = new Promise((resolveChunk, rejectChunk) => {
          ffmpeg(inputPath)
            .setStartTime(startTime)
            .setDuration(chunkDuration)
            .output(outputPath)
            .on('end', () => {
              chunks.push({ path: outputPath, index: i, startTime });
              resolveChunk();
            })
            .on('error', rejectChunk)
            .run();
        });
        
        chunkPromises.push(promise);
      }
      
      Promise.all(chunkPromises)
        .then(() => resolve({ chunks: chunks.sort((a, b) => a.index - b.index), totalChunks }))
        .catch(reject);
    }).catch(reject);
  });
}

// Transcribe a single chunk
async function transcribeChunk(chunkPath) {
  const audioBuffer = readFileSync(chunkPath);
  const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  
  const transcription = await elevenlabs.speechToText.convert({
    file: audioBlob,
    modelId: "scribe_v2",
    tagAudioEvents: true,
    languageCode: "eng",
    diarize: true, // Works well for 5-minute chunks
  });
  
  return transcription.text || (typeof transcription === 'string' ? transcription : JSON.stringify(transcription));
}

// Main transcription endpoint with chunking
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  const sessionId = uuidv4();
  const tempDir = tmpdir();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);
    console.log(`Processing audio file: ${fileSizeMB} MB`);

    // Save uploaded file temporarily
    const inputPath = join(tempDir, `input_${sessionId}.${req.file.originalname.split('.').pop() || 'mp3'}`);
    writeFileSync(inputPath, req.file.buffer);

    // Initialize session
    sessions.set(sessionId, {
      status: 'splitting',
      progress: 0,
      totalChunks: 0,
      completedChunks: 0,
      transcriptions: [],
      error: null
    });

    // Start processing in background
    processAudioWithChunks(sessionId, inputPath, tempDir);

    // Return session ID for progress tracking
    res.json({ sessionId, message: 'Transcription started' });
  } catch (error) {
    console.error('Error starting transcription:', error);
    res.status(500).json({ error: error.message || 'Failed to start transcription' });
  }
});

// Process audio with chunks
async function processAudioWithChunks(sessionId, inputPath, tempDir) {
  const session = sessions.get(sessionId);
  const chunkFiles = [];
  
  try {
    // Update status
    session.status = 'splitting';
    session.progress = 5;
    
    // Split audio into 5-minute chunks
    console.log('Splitting audio into chunks...');
    const { chunks, totalChunks } = await splitAudio(inputPath, 300); // 5 minutes
    session.totalChunks = totalChunks;
    session.progress = 10;
    chunkFiles.push(...chunks.map(c => c.path));
    
    console.log(`Split into ${totalChunks} chunks`);
    
    // Transcribe each chunk
    session.status = 'transcribing';
    const transcriptions = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Transcribing chunk ${i + 1}/${totalChunks}...`);
      
      try {
        const text = await transcribeChunk(chunk.path);
        transcriptions.push({ index: chunk.index, text, startTime: chunk.startTime });
        session.completedChunks = i + 1;
        session.progress = 10 + Math.floor((i + 1) / totalChunks * 90);
        session.transcriptions = transcriptions.sort((a, b) => a.index - b.index);
      } catch (error) {
        console.error(`Error transcribing chunk ${i + 1}:`, error);
        // Continue with other chunks even if one fails
        transcriptions.push({ index: chunk.index, text: `[Error transcribing this chunk: ${error.message}]`, startTime: chunk.startTime });
      }
      
      // Clean up chunk file
      try {
        if (existsSync(chunk.path)) {
          unlinkSync(chunk.path);
        }
      } catch (e) {
        console.warn(`Could not delete chunk file: ${e.message}`);
      }
    }
    
    // Combine all transcriptions
    const fullText = transcriptions
      .sort((a, b) => a.index - b.index)
      .map(t => t.text)
      .join('\n\n');
    
    session.status = 'completed';
    session.progress = 100;
    session.fullText = fullText;
    
    // Clean up input file
    try {
      if (existsSync(inputPath)) {
        unlinkSync(inputPath);
      }
    } catch (e) {
      console.warn(`Could not delete input file: ${e.message}`);
    }
    
    console.log('Transcription completed');
  } catch (error) {
    console.error('Error processing audio:', error);
    session.status = 'error';
    session.error = error.message;
    
    // Cleanup on error
    chunkFiles.forEach(file => {
      try {
        if (existsSync(file)) unlinkSync(file);
      } catch (e) {}
    });
    try {
      if (existsSync(inputPath)) unlinkSync(inputPath);
    } catch (e) {}
  }
}

// Progress endpoint
app.get('/api/transcribe/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    status: session.status,
    progress: session.progress,
    totalChunks: session.totalChunks,
    completedChunks: session.completedChunks,
    currentText: session.transcriptions
      .sort((a, b) => a.index - b.index)
      .map(t => t.text)
      .join('\n\n'),
    fullText: session.fullText || null,
    error: session.error
  });
});

// Cleanup old sessions (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, session] of sessions.entries()) {
    if (session.timestamp && session.timestamp < oneHourAgo) {
      sessions.delete(id);
    }
  }
}, 30 * 60 * 1000); // Run every 30 minutes

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
