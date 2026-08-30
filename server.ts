import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large base64 image uploads from camera
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Initialize Gemini client lazily
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not configured');
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  // Health API route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Gemini OCR Text Extraction API route
  app.post('/api/gemini/extract-text', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg' } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ success: false, error: 'Missing imageBase64 parameter' });
      }

      // Extract raw base64 data without data URL header
      const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');

      const ai = getGeminiClient();

      const imagePart = {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: base64Data,
        },
      };

      const promptPart = {
        text: `You are an expert OCR, document digitizer, and text extraction engine.
Carefully examine this image captured by a mobile camera. Extract all visible text, headings, body paragraphs, bullet points, key-value items, and notes with high precision.
Preserve exact wording, reading flow, and structural layout.

Respond with a JSON object following this exact structure:
{
  "title": "Brief descriptive title of the scanned document or 'Scanned Document'",
  "fullText": "The complete extracted text verbatim with normal paragraph breaks",
  "summary": "1-2 sentence quick summary of the document contents",
  "sections": [
    {
      "type": "heading" | "paragraph" | "bullet" | "callout",
      "content": "text content for this section"
    }
  ]
}

Return ONLY valid JSON. Do not include markdown code block markers.`,
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: { parts: [imagePart, promptPart] },
        config: {
          responseMimeType: 'application/json',
        },
      });

      const rawText = response.text || '{}';
      let parsed: any;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleanJson);
      }

      return res.json({
        success: true,
        data: parsed,
      });
    } catch (error: any) {
      console.error('Gemini text extraction failed:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to extract text from the camera image using Gemini.',
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Android Doc Toolkit server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
