const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// User agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

// Proxy endpoint for images
app.get('/proxy-image', async (req, res) => {
  try {
    const { imageUrl } = req.query;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL required' });
    }

    const response = await axios.get(imageUrl, {
      responseType: 'stream',
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Referer': 'https://www.amazon.com/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
      }
    });

    res.set({
      'Content-Type': response.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000'
    });

    response.data.pipe(res);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

app.post('/scrape-amazon', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('amazon.')) {
      return res.status(400).json({ error: 'Invalid Amazon URL' });
    }

    const userAgent = getRandomUserAgent();
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Extract title
    let title = "";
    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle) {
      title = ogTitle;
    } else {
      const productTitle = $('#productTitle').text().trim();
      if (productTitle) {
        title = productTitle;
      } else {
        const pageTitle = $('title').text().trim();
        title = pageTitle;
      }
    }
    
    // Decode HTML entities
    title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

    // Extract images with multiple patterns
    const images = new Set();
    
    // Pattern 1: High-res images from data attributes
    $('img[data-a-dynamic-image]').each((i, el) => {
      const dataAttr = $(el).attr('data-a-dynamic-image');
      if (dataAttr) {
        try {
          const dynamicImages = JSON.parse(dataAttr);
          Object.keys(dynamicImages).forEach(imgUrl => {
            if (imgUrl.includes('amazon.com') && !imgUrl.includes('placeholder')) {
              images.add(imgUrl);
            }
          });
        } catch (e) {
          console.log('Error parsing dynamic images:', e);
        }
      }
    });

    // Pattern 2: Standard img src
    $('img').each((i, el) => {
      const src = $(el).attr('src');
      if (src && src.includes('amazon.com') && !src.includes('placeholder') && !src.includes('icon')) {
        images.add(src);
      }
    });

    // Pattern 3: Data-src attributes
    $('img[data-src]').each((i, el) => {
      const dataSrc = $(el).attr('data-src');
      if (dataSrc && dataSrc.includes('amazon.com') && !dataSrc.includes('placeholder')) {
        images.add(dataSrc);
      }
    });

    // Pattern 4: Data-lazy-src
    $('img[data-lazy-src]').each((i, el) => {
      const lazySrc = $(el).attr('data-lazy-src');
      if (lazySrc && lazySrc.includes('amazon.com') && !lazySrc.includes('placeholder')) {
        images.add(lazySrc);
      }
    });

    // Convert to array and filter
    const imageUrls = Array.from(images).filter(url => {
      return url.includes('amazon.com') && 
             !url.includes('placeholder') && 
             !url.includes('icon') &&
             !url.includes('logo') &&
             (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.webp'));
    });

    // Get title from URL if not found in HTML
    if (!title) {
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const dpIndex = pathParts.indexOf('dp');
        if (dpIndex > 0 && dpIndex + 1 < pathParts.length) {
          const slug = pathParts[dpIndex - 1];
          title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        }
      } catch (e) {
        console.warn("Failed to parse title from URL:", e);
      }
    }

    res.json({
      title: title || "Amazon Product",
      images: imageUrls.slice(0, 20) // Limit to 20 images
    });

  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'Failed to scrape Amazon page' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
