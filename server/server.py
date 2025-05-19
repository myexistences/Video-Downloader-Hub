from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import yt_dlp
import os
import re
import logging
import sys
import time
import random
import math
import subprocess
from urllib.parse import quote
import traceback
import tempfile
import shutil
import uuid
import threading
from datetime import datetime

# Set up logging to both file and console with more detailed format
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('debug.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)

# Add a custom filter to log request details
class RequestLogFilter(logging.Filter):
    def filter(self, record):
        record.request_id = id(record)
        return True

logger.addFilter(RequestLogFilter())

app = Flask(__name__, static_folder='../client', static_url_path='')
CORS(app, resources={r"/*": {"origins": "*"}})

# Create downloads directory if it doesn't exist
DOWNLOADS_DIR = os.path.join(os.path.dirname(__file__), 'downloads')
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# Dictionary to store active downloads
active_downloads = {}
download_lock = threading.Lock()

def cleanup_old_downloads():
    """Clean up downloads older than 1 hour"""
    current_time = time.time()
    with download_lock:
        for download_id, download_info in list(active_downloads.items()):
            if current_time - download_info['start_time'] > 3600:  # 1 hour
                try:
                    if os.path.exists(download_info['temp_dir']):
                        shutil.rmtree(download_info['temp_dir'])
                    del active_downloads[download_id]
                except Exception as e:
                    logger.error(f"Error cleaning up download {download_id}: {str(e)}")

def format_size(bytes_size):
    """Convert bytes to human-readable size (e.g., MB, GB)."""
    if not bytes_size:
        return "Unknown"
    size_name = ("B", "KB", "MB", "GB")
    i = int(math.floor(math.log(bytes_size, 1024)))
    p = math.pow(1024, i)
    s = round(bytes_size / p, 2)
    return f"{s} {size_name[i]}"

def check_ffmpeg():
    """Check if ffmpeg is installed and accessible."""
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def extract_video_id(url):
    """Extract video ID from various YouTube URL formats."""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?]+)',
        r'youtube\.com\/embed\/([^&\n?]+)',
        r'youtube\.com\/v\/([^&\n?]+)'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def clean_youtube_url(url):
    """Clean and validate YouTube URL."""
    try:
        # Remove any URL parameters
        url = url.split('?')[0]
        
        # Extract video ID
        video_id = extract_video_id(url)
        if not video_id:
            raise ValueError("Invalid YouTube URL format")
            
        # Construct clean URL

        return f'https://www.youtube.com/watch?v={video_id}'
    except Exception as e:
        logger.error(f"Error cleaning URL: {str(e)}")
        raise ValueError(f"Invalid YouTube URL: {str(e)}")

def log_error(error, context=""):
    """Helper function to log errors with context"""
    error_msg = f"{context}: {str(error)}"
    logger.error(error_msg)
    logger.error(traceback.format_exc())
    return error_msg

@app.route('/')
def serve_index():
    logger.info("Serving index.html")
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    logger.info(f"Serving static file: {path}")
    return send_from_directory(app.static_folder, path)

@app.route('/api/youtube/info', methods=['GET', 'OPTIONS'])
def youtube_info():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        url = request.args.get('url')
        logger.info(f"Received YouTube info request for URL: {url}")
        
        if not url:
            error_msg = "No URL provided"
            logger.error(error_msg)
            return jsonify({'error': error_msg}), 400

        try:
            cleaned_url = clean_youtube_url(url)
            logger.info(f"Cleaned URL: {cleaned_url}")
        except ValueError as e:
            error_msg = log_error(e, "URL cleaning failed")
            return jsonify({'error': str(e)}), 400

        try:
            # Check ffmpeg availability
            ffmpeg_available = check_ffmpeg()
            logger.info(f"FFmpeg available: {ffmpeg_available}")
            
            # yt-dlp options for fetching video info
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': False,
                'format': 'best',
                'youtube_include_dash_manifest': True,
                'format_sort': ['res:1080', 'res:720', 'res:480', 'res:360', 'ext:mp4:m4a'],
                'format_selection': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                'verbose': True
            }
            
            logger.info("Starting video info extraction with yt-dlp")
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(cleaned_url, download=False)
            logger.info("Successfully extracted video info")
            
            # Log available formats
            logger.debug(f"Available formats: {len(info.get('formats', []))}")
            
            # Get available video formats
            formats = [
                f for f in info['formats']
                if f.get('ext') == 'mp4' and 
                f.get('vcodec') and f.get('vcodec') != 'none' and 
                f.get('height') in [1080, 720, 480, 360]
            ]
            logger.info(f"Filtered formats count: {len(formats)}")
            
            # Sort by resolution
            formats = sorted(formats, key=lambda x: int(x.get('height', 0)), reverse=True)
            
            # Build options list
            available_formats = []
            available_resolutions = {f.get('height') for f in formats}
            desired_resolutions = [1080, 720, 480, 360]
            
            logger.info(f"Available resolutions: {available_resolutions}")
            
            for height in desired_resolutions:
                if height in available_resolutions:
                    logger.debug(f"Processing {height}p format")
                    fmt = max(
                        (f for f in formats if f.get('height') == height),
                        key=lambda x: (x.get('acodec') != 'none', x.get('filesize', 0) or x.get('filesize_approx', 0)),
                        default=None
                    )
                    if fmt:
                        format_info = {
                            'itag': fmt['format_id'],
                            'mimeType': 'video/mp4',
                            'quality': f"{height}p",
                            'size': format_size(fmt.get('filesize', 0) or fmt.get('filesize_approx', 0)),
                            'hasAudio': fmt.get('acodec') and fmt.get('acodec') != 'none',
                            'audioCodec': fmt.get('acodec', 'Unknown'),
                            'audioStatus': "Includes Audio" if fmt.get('acodec') != 'none' else "No Audio + Includes Audio",
                            'type': 'video',
                            'url': fmt.get('url', ''),
                            'format_note': fmt.get('format_note', ''),
                            'fps': fmt.get('fps', ''),
                            'vcodec': fmt.get('vcodec', ''),
                            'acodec': fmt.get('acodec', '')
                        }
                        available_formats.append(format_info)
                        logger.debug(f"Added format: {format_info['quality']} - {format_info['audioStatus']}")

            # Add MP3 option if ffmpeg is available
            if ffmpeg_available:
                available_formats.append({
                    'itag': 'bestaudio',
                    'mimeType': 'audio/mp3',
                    'quality': 'MP3',
                    'size': 'Unknown',
                    'hasAudio': True,
                    'audioCodec': 'MP3',
                    'audioStatus': 'High-quality MP3',
                    'type': 'audio',
                    'url': info.get('url', '')
                })
                logger.info("Added MP3 format option")

            response_data = {
                'title': info.get('title', ''),
                'thumbnail': info.get('thumbnail', ''),
                'duration': info.get('duration', 0),
                'author': info.get('uploader', ''),
                'formats': available_formats,
                'ffmpegAvailable': ffmpeg_available
            }
            
            logger.info(f"Successfully prepared response with {len(available_formats)} formats")
            return jsonify(response_data)

        except Exception as e:
            error_msg = log_error(e, "Error extracting video info")
            return jsonify({
                'error': 'Failed to fetch video info',
                'details': error_msg
            }), 500

    except Exception as e:
        error_msg = log_error(e, "Error processing request")
        return jsonify({
            'error': 'Failed to fetch video info',
            'details': error_msg
        }), 500

@app.route('/api/youtube/download', methods=['GET', 'OPTIONS'])
def youtube_download():
    if request.method == 'OPTIONS':
        return '', 200
        
    download_id = str(uuid.uuid4())
    
    try:
        url = request.args.get('url')
        itag = request.args.get('itag')
        format_type = request.args.get('type', 'video')
        logger.info(f"Download request - ID: {download_id}, URL: {url}, format: {itag}, type: {format_type}")
        
        if not url or not itag:
            error_msg = "Missing URL or format"
            logger.error(error_msg)
            return jsonify({'error': error_msg}), 400

        try:
            cleaned_url = clean_youtube_url(url)
            logger.info(f"Cleaned URL for download: {cleaned_url}")
        except ValueError as e:
            error_msg = log_error(e, "URL cleaning failed")
            return jsonify({'error': str(e)}), 400

        # Create a unique temporary directory for this download
        temp_dir = os.path.join(DOWNLOADS_DIR, download_id)
        os.makedirs(temp_dir, exist_ok=True)
        
        # Register the download
        with download_lock:
            active_downloads[download_id] = {
                'temp_dir': temp_dir,
                'start_time': time.time()
            }

        try:
            # Configure yt-dlp options
            if format_type == 'video':
                if itag == 'bestaudio':
                    format_spec = 'bestaudio/best'
                else:
                    format_spec = f"{itag}+bestaudio/best" if check_ffmpeg() else itag
            else:  # audio
                format_spec = 'bestaudio/best'

            logger.info(f"Using format specification: {format_spec}")

            ydl_opts = {
                'format': format_spec,
                'outtmpl': os.path.join(temp_dir, '%(title)s.%(ext)s'),
                'quiet': True,
                'no_warnings': True,
                'verbose': True,
                'retries': 3,
                'fragment_retries': 3,
                'socket_timeout': 30,
                'extractor_retries': 3,
                'ignoreerrors': False,
                'no_color': True,
                'progress_hooks': [lambda d: logger.info(f"Download progress for {download_id}: {d.get('_percent_str', '0%')}")]
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                logger.info(f"Starting download for {download_id}")
                try:
                    info = ydl.extract_info(cleaned_url, download=True)
                    if not info:
                        raise Exception("Failed to extract video information")
                    logger.info(f"Download completed for {download_id}")

                    # Get the downloaded file
                    files = os.listdir(temp_dir)
                    if not files:
                        raise Exception("No file was downloaded")
                    
                    downloaded_file = os.path.join(temp_dir, files[0])
                    logger.info(f"Downloaded file for {download_id}: {downloaded_file}")

                    # Send the file
                    response = send_file(
                        downloaded_file,
                        as_attachment=True,
                        download_name=os.path.basename(downloaded_file)
                    )

                    # Schedule cleanup after response is sent
                    def cleanup():
                        time.sleep(5)  # Wait for file to be sent
                        try:
                            with download_lock:
                                if download_id in active_downloads:
                                    shutil.rmtree(temp_dir)
                                    del active_downloads[download_id]
                        except Exception as e:
                            logger.error(f"Error cleaning up {download_id}: {str(e)}")

                    threading.Thread(target=cleanup).start()
                    return response

                except Exception as e:
                    error_msg = f"Download failed: {str(e)}"
                    logger.error(error_msg)
                    logger.error(traceback.format_exc())
                    return jsonify({
                        'error': error_msg,
                        'details': traceback.format_exc()
                    }), 500

        except Exception as e:
            error_msg = log_error(e, "Download failed")
            return jsonify({
                'error': 'Failed to download video',
                'details': error_msg
            }), 500

    except Exception as e:
        error_msg = log_error(e, "Download error")
        return jsonify({
            'error': 'Failed to get download URL',
            'details': error_msg
        }), 500

    finally:
        # Clean up old downloads periodically
        cleanup_old_downloads()

if __name__ == '__main__':
    logger.info("Server starting on http://localhost:3001")
    logger.info("Open your browser and go to: http://localhost:3001")
    app.run(port=3001, debug=True) 