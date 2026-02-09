const audioFileInput = document.getElementById('audioFile');
const transcribeBtn = document.getElementById('transcribeBtn');
const transcriptionDiv = document.getElementById('transcription');
const downloadBtn = document.getElementById('downloadBtn');

let transcriptionText = '';

transcribeBtn.addEventListener('click', async () => {
    const file = audioFileInput.files[0];
    if (!file) {
        alert('Please select an audio file');
        return;
    }

    transcriptionDiv.textContent = 'Transcribing...';
    transcribeBtn.disabled = true;

    try {
        const transcription = await transcribeAudio(file);
        
        transcriptionText = transcription;
        transcriptionDiv.textContent = transcription;
        downloadBtn.style.display = 'block';
    } catch (error) {
        transcriptionDiv.textContent = 'Error: ' + error.message;
    } finally {
        transcribeBtn.disabled = false;
    }
});

downloadBtn.addEventListener('click', () => {
    if (!transcriptionText) {
        alert('No transcription available');
        return;
    }

    const blob = new Blob([transcriptionText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcription.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

async function transcribeAudio(file) {
    const API_URL = 'http://localhost:3000/api/transcribe';
    
    const formData = new FormData();
    formData.append('audio', file);
    
    const response = await fetch(API_URL, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.transcription;
}

