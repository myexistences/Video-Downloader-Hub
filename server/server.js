const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const { IgApiClient } = require('instagram-private-api');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helper function to clean YouTube URL
function cleanYouTubeUrl(url) {
    try {
        // Remove any query parameters
        url = url.split('?')[0];
        // Remove any trailing slashes
        url = url.replace(/\/$/, '');
        return url;
    } catch (error) {
        console.error('Error cleaning URL:', error);
        return url;
    }
}

// YouTube video info endpoint
app.get('/api/youtube/info', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) {
            console.log('No URL provided');
            return res.status(400).json({ error: 'URL is required' });
        }

        console.log('Original URL:', url);
        const cleanedUrl = cleanYouTubeUrl(url);
        console.log('Cleaned URL:', cleanedUrl);

        // Validate YouTube URL
        if (!ytdl.validateURL(cleanedUrl)) {
            console.log('Invalid YouTube URL:', cleanedUrl);
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        console.log('Getting video info...');
        const info = await ytdl.getInfo(cleanedUrl, {
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            }
        });
        
        console.log('Video info received:', {
            title: info.videoDetails.title,
            duration: info.videoDetails.lengthSeconds,
            author: info.videoDetails.author.name
        });

        // Filter formats to only include video+audio formats
        const formats = ytdl.filterFormats(info.formats, 'videoandaudio')
            .map(format => ({
                itag: format.itag,
                mimeType: format.mimeType,
                quality: format.qualityLabel || 'audio',
                size: format.contentLength ? `${Math.round(format.contentLength / 1024 / 1024)}MB` : 'Unknown'
            }));

        // If no video+audio formats found, try to get separate video and audio formats
        if (formats.length === 0) {
            const videoFormats = ytdl.filterFormats(info.formats, 'videoonly');
            const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
            
            formats.push(...videoFormats.map(format => ({
                itag: format.itag,
                mimeType: format.mimeType,
                quality: format.qualityLabel || 'video',
                size: format.contentLength ? `${Math.round(format.contentLength / 1024 / 1024)}MB` : 'Unknown'
            })));
            
            formats.push(...audioFormats.map(format => ({
                itag: format.itag,
                mimeType: format.mimeType,
                quality: 'audio',
                size: format.contentLength ? `${Math.round(format.contentLength / 1024 / 1024)}MB` : 'Unknown'
            })));
        }

        console.log('Available formats:', formats.length);

        res.json({
            title: info.videoDetails.title,
            thumbnail: info.videoDetails.thumbnails[0].url,
            duration: info.videoDetails.lengthSeconds,
            author: info.videoDetails.author.name,
            formats
        });
    } catch (error) {
        console.error('YouTube info error:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch video info',
            details: error.message
        });
    }
});

// YouTube download endpoint
app.get('/api/youtube/download', async (req, res) => {
    try {
        const { url, itag } = req.query;
        if (!url || !itag) {
            return res.status(400).json({ error: 'URL and format are required' });
        }

        const cleanedUrl = cleanYouTubeUrl(url);
        const info = await ytdl.getInfo(cleanedUrl);
        const format = ytdl.chooseFormat(info.formats, { quality: itag });
        
        res.header('Content-Disposition', `attachment; filename="${info.videoDetails.title}.${format.container}"`);
        ytdl(cleanedUrl, { format }).pipe(res);
    } catch (error) {
        console.error('YouTube download error:', error);
        res.status(500).json({ error: 'Failed to download video' });
    }
});

// Instagram video info endpoint
app.get('/api/instagram/info', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Extract media ID from URL
        const mediaId = url.split('/p/')[1]?.split('/')[0];
        if (!mediaId) {
            return res.status(400).json({ error: 'Invalid Instagram URL' });
        }

        const ig = new IgApiClient();
        ig.state.generateDevice(process.env.IG_USERNAME);
        await ig.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD);

        const media = await ig.media.info(mediaId);
        
        res.json({
            title: media.caption?.text || 'Instagram Post',
            thumbnail: media.image_versions2?.candidates[0]?.url || media.video_versions[0]?.url,
            author: media.user.username,
            formats: [
                {
                    itag: 'high',
                    mimeType: 'video/mp4',
                    quality: 'High Quality'
                },
                {
                    itag: 'low',
                    mimeType: 'video/mp4',
                    quality: 'Low Quality'
                }
            ]
        });
    } catch (error) {
        console.error('Instagram info error:', error);
        res.status(500).json({ error: 'Failed to fetch video info' });
    }
});

// Instagram download endpoint
app.get('/api/instagram/download', async (req, res) => {
    try {
        const { url, itag } = req.query;
        if (!url || !itag) {
            return res.status(400).json({ error: 'URL and format are required' });
        }

        const mediaId = url.split('/p/')[1]?.split('/')[0];
        if (!mediaId) {
            return res.status(400).json({ error: 'Invalid Instagram URL' });
        }

        const ig = new IgApiClient();
        ig.state.generateDevice(process.env.IG_USERNAME);
        await ig.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD);

        const media = await ig.media.info(mediaId);
        const videoUrl = itag === 'high' ? 
            media.video_versions[0]?.url : 
            media.video_versions[media.video_versions.length - 1]?.url;

        if (!videoUrl) {
            return res.status(404).json({ error: 'Video not found' });
        }

        res.header('Content-Disposition', `attachment; filename="instagram-video.mp4"`);
        res.redirect(videoUrl);
    } catch (error) {
        console.error('Instagram download error:', error);
        res.status(500).json({ error: 'Failed to download video' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});