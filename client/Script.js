console.log('Script loaded at:', new Date().toISOString());

// Tab Switching
const tabs = document.querySelectorAll('.tab');
if (!tabs.length) {
  console.error('No .tab elements found in HTML');
} else {
  console.log('Found', tabs.length, 'tabs');
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const tabId = tab.getAttribute('data-tab');
    document.getElementById(`${tabId}-content`).classList.add('active');
  });
});

// Format Options Selection
function setupFormatOptions(containerId) {
  const options = document.querySelectorAll(`#${containerId} .format-option`);
  console.log(`Setting up format options for ${containerId}:`, options.length, 'options found');
  options.forEach(option => {
    option.addEventListener('click', () => {
      option.parentElement.querySelectorAll('.format-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      const downloadBtn = document.getElementById(containerId.replace('formats', 'download'));
      if (downloadBtn) {
        downloadBtn.disabled = false;
        console.log('Enabled download button for', containerId);
      }
    });
  });
}

// Helper function to clean YouTube URL
function cleanYouTubeUrl(url) {
    try {
        // Convert shorts URL to regular video URL
        if (url.includes('/shorts/')) {
            url = url.replace('/shorts/', '/watch?v=');
        }
        // Remove query parameters and trailing slashes
        url = url.split('?')[0];
        url = url.rstrip('/');
        return url;
    } catch (error) {
        console.error('Error cleaning URL:', error);
        return url;
    }
}

// Add debug logging utility
const DEBUG = true;

function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    
    if (DEBUG) {
        switch(type) {
            case 'error':
                console.error(logMessage);
                break;
            case 'warn':
                console.warn(logMessage);
                break;
            case 'success':
                console.log('%c' + logMessage, 'color: green');
                break;
            default:
                console.log(logMessage);
        }
    }
}

// Add this at the top of the file, after the existing console.log
function showNotification(message, type = 'error') {
    // Remove any existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-message">${message}</div>
            <button class="notification-close">&times;</button>
        </div>
    `;

    // Add to document
    document.body.appendChild(notification);

    // Add close button functionality
    const closeButton = notification.querySelector('.notification-close');
    closeButton.addEventListener('click', () => {
        notification.remove();
    });

    // Auto-remove after 5 seconds for errors, 3 seconds for success
    setTimeout(() => {
        notification.remove();
    }, type === 'error' ? 5000 : 3000);
}

// YouTube Fetch Function
async function fetchYouTubeInfo(url) {
    log(`Starting fetchYouTubeInfo for URL: ${url}`);
    
    const error = document.getElementById('youtube-error');
    const loading = document.getElementById('youtube-loading');
    const result = document.getElementById('youtube-result');
    const downloadBtn = document.getElementById('youtube-download');
    const fetchBtn = document.getElementById('youtube-fetch');

    if (!error || !loading || !result || !downloadBtn || !fetchBtn) {
        log('Required elements not found', 'error');
        return;
    }

    error.style.display = 'none';
    loading.style.display = 'block';
    result.style.display = 'none';
    downloadBtn.disabled = true;
    fetchBtn.disabled = true;
    log('Updated UI state for loading');

    try {
        log('Original URL:', url);
        const cleanedUrl = cleanYouTubeUrl(url);
        log('Cleaned URL:', cleanedUrl);

        log('Fetching YouTube info from server');
        const response = await fetch(`/api/youtube/info?url=${encodeURIComponent(cleanedUrl)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        log(`Response status: ${response.status}`);
        const data = await response.json();
        log('Received server response');

        if (response.ok) {
            if (!data.title || !data.formats || data.formats.length === 0) {
                throw new Error('Invalid response data received from server');
            }

            log('Processing video info', 'success');
            
            // Update UI elements
            const thumbnail = document.getElementById('youtube-thumbnail');
            const title = document.getElementById('youtube-title');
            const duration = document.getElementById('youtube-duration');
            const author = document.getElementById('youtube-author');
            
            if (thumbnail) thumbnail.src = data.thumbnail;
            if (title) title.textContent = data.title;
            if (duration) duration.textContent = `Duration: ${new Date(data.duration * 1000).toISOString().substr(11, 8)}`;
            if (author) author.textContent = `Channel: ${data.author}`;
            log('Updated video info in UI');

            const formatsContainer = document.getElementById('youtube-formats');
            if (formatsContainer) {
                formatsContainer.innerHTML = data.formats.map((format, index) => `
                    <div class="format-option ${index === 0 ? 'selected' : ''}" 
                         data-format='${JSON.stringify(format)}'>
                        <strong>${format.mimeType.split('/')[1].toUpperCase()} ${format.quality}</strong>
                        <p>Size: ${format.size}</p>
                        <p>Audio: ${format.audioStatus}</p>
                        ${format.fps ? `<p>FPS: ${format.fps}</p>` : ''}
                    </div>
                `).join('');

                setupFormatOptions('youtube-formats');
                log(`Rendered ${data.formats.length} format options`);
            }

            result.style.display = 'block';
            downloadBtn.disabled = false;
            log('Updated UI for success state', 'success');
        } else {
            log(`YouTube API error: ${data.error}`, 'error');
            error.textContent = data.error + (data.details ? `: ${data.details}` : '');
            error.style.display = 'block';
        }
    } catch (err) {
        log(`Error: ${err.message}`, 'error');
        error.textContent = `Error: ${err.message}. Please try again.`;
        error.style.display = 'block';
    } finally {
        loading.style.display = 'none';
        fetchBtn.disabled = false;
        log('Reset loading state');
    }
}

// YouTube Input Handling
const youtubeFetchBtn = document.getElementById('youtube-fetch');
const youtubeUrlInput = document.getElementById('youtube-url');

if (!youtubeFetchBtn || !youtubeUrlInput) {
    console.error('YouTube elements not found:', {
        fetchBtn: !!youtubeFetchBtn,
        urlInput: !!youtubeUrlInput
    });
} else {
    // Handle Enter key press
    youtubeUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            youtubeFetchBtn.click();
        }
    });

    // Handle fetch button click
    youtubeFetchBtn.addEventListener('click', () => {
        const url = youtubeUrlInput.value.trim();
        const error = document.getElementById('youtube-error');
        
        if (!url) {
            error.textContent = 'Please enter a YouTube URL';
            error.style.display = 'block';
            return;
        }
        
        if (!url.includes('youtube.com/') && !url.includes('youtu.be/')) {
            error.textContent = 'Please enter a valid YouTube URL (should contain youtube.com or youtu.be)';
            error.style.display = 'block';
            return;
        }
        
        console.log('Fetching info for URL:', url);
        fetchYouTubeInfo(url);
    });
}

// YouTube Download
const youtubeDownloadBtn = document.getElementById('youtube-download');
if (!youtubeDownloadBtn) {
  console.error('YouTube download button not found (ID: youtube-download)');
} else {
  youtubeDownloadBtn.addEventListener('click', async () => {
    console.log('YouTube Download button clicked');
    const selectedOption = document.querySelector('#youtube-formats .format-option.selected');
    if (selectedOption) {
        const format = JSON.parse(selectedOption.getAttribute('data-format'));
        const url = document.getElementById('youtube-url').value.trim();
        await downloadYouTubeVideo(url, format);
    } else {
        alert('Please select a format first');
    }
  });
}

// Instagram Fetch Function
async function fetchInstagramInfo(url) {
  console.log('Fetching Instagram info for URL:', url);
  const error = document.getElementById('instagram-error');
  const loading = document.getElementById('instagram-loading');
  const result = document.getElementById('instagram-result');
  const downloadBtn = document.getElementById('instagram-download');

  error.style.display = 'none';
  loading.style.display = 'block';
  result.style.display = 'none';
  downloadBtn.disabled = true;

  try {
    const response = await fetch(`http://localhost:3001/api/instagram/info?url=${encodeURIComponent(url)}`);
    console.log('Instagram API response status:', response.status);
    const data = await response.json();
    console.log('Instagram API response data:', data);

    if (response.ok) {
      document.getElementById('instagram-thumbnail').src = data.thumbnail;
      document.getElementById('instagram-title').textContent = data.title;
      document.getElementById('instagram-author').textContent = `User: @${data.author}`;

      const formatsContainer = document.getElementById('instagram-formats');
      formatsContainer.innerHTML = data.formats.map((format, index) => `
        <div class="format-option ${index === 0 ? 'selected' : ''}" data-format="${format.itag}">
          <strong>${format.mimeType.split('/')[1].toUpperCase()} ${format.quality}</strong>
        </div>
      `).join('');
      console.log('Rendered', data.formats.length, 'Instagram formats');

      setupFormatOptions('instagram-formats');
      result.style.display = 'block';
      downloadBtn.disabled = false;
    } else {
      error.textContent = data.error || 'Failed to fetch video info';
      error.style.display = 'block';
      console.error('Instagram API error:', data.error);
    }
  } catch (err) {
    console.error('Instagram Fetch error:', err.message);
    error.textContent = `Network error: ${err.message}. Is backend running at http://localhost:3001?`;
    error.style.display = 'block';
  } finally {
    loading.style.display = 'none';
  }
}

// Instagram Input Handling
const instagramUrlInput = document.getElementById('instagram-url');
if (!instagramUrlInput) {
  console.error('Instagram URL input not found (ID: instagram-url)');
} else {
  instagramUrlInput.addEventListener('input', () => {
    const url = instagramUrlInput.value.trim();
    console.log('Instagram URL input:', url);
    
    // Clear previous states
    const error = document.getElementById('instagram-error');
    const loading = document.getElementById('instagram-loading');
    const result = document.getElementById('instagram-result');
    
    error.style.display = 'none';
    result.style.display = 'none';
    
    if (url && url.includes('instagram.com/')) {
      // Show loading state immediately
      loading.style.display = 'block';
      fetchInstagramInfo(url);
    } else if (url) {
      error.textContent = 'Please enter a valid Instagram video or reel URL';
      error.style.display = 'block';
    }
  });
}

// Instagram Download
const instagramDownloadBtn = document.getElementById('instagram-download');
if (!instagramDownloadBtn) {
  console.error('Instagram download button not found (ID: instagram-download)');
} else {
  instagramDownloadBtn.addEventListener('click', () => {
    console.log('Instagram Download button clicked');
    const selectedFormat = document.querySelector('#instagram-formats .format-option.selected')?.getAttribute('data-format');
    const url = document.getElementById('instagram-url').value.trim();
    if (selectedFormat && url) {
      const downloadUrl = `http://localhost:3001/api/instagram/download?url=${encodeURIComponent(url)}&itag=${selectedFormat}`;
      console.log('Initiating download:', downloadUrl);
      window.location.href = downloadUrl;
    } else {
      console.error('Download failed: No format selected or URL missing');
    }
  });
}

async function downloadYouTubeVideo(url, format) {
    log(`Starting download for URL: ${url} with format: ${JSON.stringify(format)}`);
    
    try {
        // Show loading state
        const downloadBtn = document.getElementById('youtube-download');
        const originalText = downloadBtn.textContent;
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Downloading...';
        log('Updated download button state');

        // Hide format selection
        const formatsContainer = document.getElementById('youtube-formats');
        if (formatsContainer) {
            formatsContainer.style.display = 'none';
            log('Hidden format selection');
        }

        // Create progress bar container if it doesn't exist
        let progressContainer = document.querySelector('.progress-container');
        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            progressContainer.innerHTML = `
                <div class="progress-bar">
                    <div class="progress"></div>
                </div>
                <div class="progress-text">Preparing download...</div>
            `;
            document.getElementById('youtube-result').appendChild(progressContainer);
            log('Created progress bar container');
        }

        // Start download
        log('Initiating download');
        const response = await fetch(`/api/youtube/download?url=${encodeURIComponent(url)}&itag=${format.itag}&type=${format.type}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error || 'Download failed';
            const errorDetails = errorData.details ? `\n\nDetails: ${errorData.details}` : '';
            throw new Error(errorMessage + errorDetails);
        }

        // Get the filename from the Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = contentDisposition
            ? contentDisposition.split('filename=')[1].replace(/"/g, '')
            : 'video.mp4';

        // Create a blob from the response
        const blob = await response.blob();
        log('Download completed, creating blob', 'success');

        // Create download link
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(link);
        
        // Update progress bar to show completion
        const progressBar = progressContainer.querySelector('.progress');
        const progressText = progressContainer.querySelector('.progress-text');
        progressBar.style.width = '100%';
        progressText.textContent = 'Download Complete!';
        
        // Show success notification
        showNotification('Download completed successfully!', 'success');
        
        // Remove progress bar after 3 seconds
        setTimeout(() => {
            progressContainer.remove();
            // Show format selection again
            if (formatsContainer) {
                formatsContainer.style.display = 'grid';
            }
            log('Reset UI after successful download', 'success');
        }, 3000);

    } catch (error) {
        log(`Download error: ${error.message}`, 'error');
        showNotification(error.message);
        
        const downloadBtn = document.getElementById('youtube-download');
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Download';
        
        // Remove progress bar if it exists
        const progressContainer = document.querySelector('.progress-container');
        if (progressContainer) {
            progressContainer.remove();
            log('Removed progress bar after error');
        }

        // Show format selection again
        const formatsContainer = document.getElementById('youtube-formats');
        if (formatsContainer) {
            formatsContainer.style.display = 'grid';
            log('Restored format selection after error');
        }
    }
}