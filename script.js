const audioFileInput = document.getElementById('audioFile');
const transcribeBtn = document.getElementById('transcribeBtn');
const transcriptionDiv = document.getElementById('transcription');
const downloadBtn = document.getElementById('downloadBtn');
const progressDiv = document.getElementById('progress');

let transcriptionText = '';
let sessionId = null;
let progressInterval = null;

transcribeBtn.addEventListener('click', async () => {
    const file = audioFileInput.files[0];
    if (!file) {
        alert('Please select an audio file');
        return;
    }

    transcriptionDiv.textContent = '';
    progressDiv.textContent = 'Starting transcription...';
    transcribeBtn.disabled = true;
    downloadBtn.style.display = 'none';

    try {
        // Start transcription
        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: (() => {
                const formData = new FormData();
                formData.append('audio', file);
                return formData;
            })()
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        sessionId = data.sessionId;

        // Start polling for progress
        startProgressPolling();
    } catch (error) {
        transcriptionDiv.textContent = 'Error: ' + error.message;
        progressDiv.textContent = '';
        transcribeBtn.disabled = false;
    }
});

function startProgressPolling() {
    if (progressInterval) {
        clearInterval(progressInterval);
    }

    progressInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/transcribe/${sessionId}`);
            const data = await response.json();

            // Update progress
            progressDiv.textContent = `Progress: ${data.progress}% (${data.completedChunks || 0}/${data.totalChunks || 0} chunks) - ${data.status}`;

            // Update transcription text as it comes in
            if (data.currentText) {
                transcriptionText = data.currentText;
                transcriptionDiv.textContent = data.currentText;
            }

            // Check if completed
            if (data.status === 'completed') {
                clearInterval(progressInterval);
                progressInterval = null;
                
                if (data.fullText) {
                    transcriptionText = data.fullText;
                    transcriptionDiv.textContent = data.fullText;
                }
                
                progressDiv.textContent = 'Transcription completed!';
                downloadBtn.style.display = 'block';
                transcribeBtn.disabled = false;
            } else if (data.status === 'error') {
                clearInterval(progressInterval);
                progressInterval = null;
                transcriptionDiv.textContent = 'Error: ' + (data.error || 'Unknown error');
                progressDiv.textContent = '';
                transcribeBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error polling progress:', error);
        }
    }, 2000); // Poll every 2 seconds
}

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
