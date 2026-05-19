import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { isOneDriveConfigured, uploadToSharePoint } from './onedrive.mjs';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('[server] GEMINI_API_KEY missing. Copy .env.example to .env and add your key.');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');

const ai = new GoogleGenAI({ apiKey });
const app = express();
app.use(express.json({ limit: '50mb' }));

const log = (...a) => console.log('[server]', ...a);

// ── Helpers ────────────────────────────────────────────────────────────────

const ASPECT_TO_IMAGEN = {
  '1:1': '1:1',
  '16:9': '16:9',
  '9:16': '9:16',
  '4:3': '4:3',
  '3:4': '3:4',
};

// Imagen supports: 1:1, 3:4, 4:3, 9:16, 16:9
// Map arbitrary requests (e.g. 4:5) to the closest supported one.
function mapAspectForImagen(aspect) {
  if (ASPECT_TO_IMAGEN[aspect]) return ASPECT_TO_IMAGEN[aspect];
  const [w, h] = aspect.split(':').map(Number);
  if (!w || !h) return '1:1';
  const r = w / h;
  const candidates = Object.values(ASPECT_TO_IMAGEN).map((a) => {
    const [aw, ah] = a.split(':').map(Number);
    return { a, r: aw / ah };
  });
  candidates.sort((x, y) => Math.abs(x.r - r) - Math.abs(y.r - r));
  return candidates[0].a;
}

function dataUrlToInline(dataUrl) {
  // expects "data:image/png;base64,AAA..."
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function inlineToDataUrl(mimeType, data) {
  return `data:${mimeType};base64,${data}`;
}

// ── Routes ─────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.json({ ok: true }));

/**
 * POST /api/suggest
 * Body: { brief: string, context: object }
 * Returns a structured set of multi-choice creative directions for the artist
 * to mix-and-match before generating.
 */
app.post('/api/suggest', async (req, res) => {
  try {
    const { brief = {}, hasAssets = {} } = req.body || {};

    const systemPrompt = `You are a senior art director at Playtika making marketing creative for casual mobile games.
Given the brief, propose a short, mix-and-match checklist of *creative directions* the artist can toggle ON to steer image generation.
Cover these categories: composition, mood, color, effects, copy treatment, format.
Each item must be ONE short imperative phrase (max ~7 words).
Return STRICT JSON with shape:
{"suggestions":[{"id":"s1","category":"composition","label":"Hero character holding the item"}, ...]}
Aim for 10-14 items, varied, concrete and actionable. No duplicates. No prefixes like "Use" or "Add" unless natural.`;

    const userPayload = {
      theme: brief.theme,
      seasons: brief.seasons,
      styles: brief.styles,
      features: brief.features, // e.g. ["pop-up", "ad", "social"]
      titles: brief.titles,
      copyExamples: brief.copyExamples,
      notes: brief.notes,
      hasCharacters: !!hasAssets.characters,
      hasItems: !!hasAssets.items,
      hasLogo: !!hasAssets.logo,
      hasReferences: !!hasAssets.references,
    };

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }, { text: JSON.stringify(userPayload) }] },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.9,
      },
    });

    const text = result.text ?? '';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Best-effort: strip code fences if present
      const stripped = text.replace(/^```json\s*|```$/g, '');
      parsed = JSON.parse(stripped);
    }
    res.json(parsed);
  } catch (err) {
    log('suggest error', err?.message);
    res.status(500).json({ error: err?.message || 'suggest failed' });
  }
});

/**
 * POST /api/generate
 * Body: {
 *   prompt: string,
 *   aspect: "1:1" | "16:9" | "9:16" | "4:5" | ...,
 *   model: "imagen-4" | "imagen-3" | "gemini-image",
 *   count: number,
 *   references: [{ kind: "character"|"item"|"logo"|"reference", dataUrl: string }]
 * }
 * Returns: { images: [{ dataUrl, mimeType, model }] }
 */
app.post('/api/generate', async (req, res) => {
  try {
    const {
      prompt,
      aspect = '1:1',
      model = 'imagen-4',
      count = 1,
      references = [],
    } = req.body || {};

    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    // If references are provided, we MUST use a multimodal-capable model
    // (Imagen text-to-image cannot consume reference images directly).
    const hasRefs = Array.isArray(references) && references.length > 0;
    const effectiveModel = hasRefs ? 'gemini-image' : model;

    const out = [];

    if (effectiveModel === 'gemini-image') {
      const geminiModel = 'gemini-2.5-flash-image-preview';
      // Build a parts array: references then the styled prompt.
      const parts = [];
      for (const r of references) {
        const inline = dataUrlToInline(r.dataUrl);
        if (inline) {
          const labelHint =
            r.kind === 'character'
              ? 'Reference of a CHARACTER that must appear faithfully (preserve identity, proportions, colors).'
              : r.kind === 'item'
              ? 'Reference of an ITEM/PROP that may appear in the scene.'
              : r.kind === 'logo'
              ? 'Reference of a LOGO — render it crisp and unaltered if shown.'
              : 'Visual style reference — match mood/lighting/style.';
          parts.push({ text: labelHint });
          parts.push({ inlineData: inline });
        }
      }
      parts.push({
        text:
          `${prompt}\n\nAspect ratio: ${aspect}. Render a single hero composition. ` +
          `Output one image, high quality, marketing-ready.`,
      });

      // Loop to produce `count` variations (Gemini image returns 1 per call).
      for (let i = 0; i < count; i++) {
        const r = await ai.models.generateContent({
          model: geminiModel,
          contents: [{ role: 'user', parts }],
          config: { responseModalities: ['IMAGE', 'TEXT'] },
        });
        const candidates = r.candidates || [];
        for (const c of candidates) {
          for (const p of c.content?.parts || []) {
            if (p.inlineData?.data) {
              out.push({
                dataUrl: inlineToDataUrl(p.inlineData.mimeType || 'image/png', p.inlineData.data),
                mimeType: p.inlineData.mimeType || 'image/png',
                model: geminiModel,
              });
            }
          }
        }
      }
    } else {
      // Imagen text-to-image
      const imagenModel =
        effectiveModel === 'imagen-3' ? 'imagen-3.0-generate-002' : 'imagen-4.0-generate-001';
      const r = await ai.models.generateImages({
        model: imagenModel,
        prompt,
        config: {
          numberOfImages: Math.max(1, Math.min(4, count)),
          aspectRatio: mapAspectForImagen(aspect),
        },
      });
      for (const g of r.generatedImages || []) {
        const mime = g.image?.mimeType || 'image/png';
        const data = g.image?.imageBytes;
        if (data) {
          out.push({ dataUrl: inlineToDataUrl(mime, data), mimeType: mime, model: imagenModel });
        }
      }
    }

    if (!out.length) {
      return res
        .status(502)
        .json({ error: 'Model returned no image. Try simplifying the prompt or removing references.' });
    }

    res.json({ images: out });
  } catch (err) {
    log('generate error', err?.message);
    res.status(500).json({ error: err?.message || 'generate failed' });
  }
});

// ── Video jobs (async pattern — survives App Service timeouts) ────────────
// Veo can take 1-4 minutes, longer than App Service's 230s request limit.
// /api/video starts a background job and returns a jobId; the client polls
// /api/video/:jobId, and downloads bytes from /api/video/:jobId/file once done.

const videoDir = path.join(os.tmpdir(), 'playtika-art-studio-videos');
fs.mkdirSync(videoDir, { recursive: true });

/** @type {Map<string, { status: string, error?: string, mp4Path?: string, model?: string, sharepoint?: any, prompt?: string, createdAt: number }>} */
const videoJobs = new Map();

// Cleanup jobs older than 2h.
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of videoJobs) {
    if (now - job.createdAt > 2 * 60 * 60 * 1000) {
      if (job.mp4Path) fs.rm(job.mp4Path, { force: true }, () => {});
      videoJobs.delete(id);
    }
  }
}, 10 * 60 * 1000).unref();

async function runVideoJob(jobId, { prompt, imageDataUrl, model, filenameHint }) {
  const job = videoJobs.get(jobId);
  if (!job) return;
  try {
    const veoModel = model === 'veo-2' ? 'veo-2.0-generate-001' : 'veo-3.0-generate-preview';
    const request = {
      model: veoModel,
      prompt: prompt || 'Cinematic animation, subtle parallax, marketing-ready 5s loop.',
      config: { numberOfVideos: 1 },
    };
    if (imageDataUrl) {
      const inline = dataUrlToInline(imageDataUrl);
      if (inline) request.image = { imageBytes: inline.data, mimeType: inline.mimeType };
    }

    let op = await ai.models.generateVideos(request);
    const started = Date.now();
    const timeoutMs = 6 * 60 * 1000;
    while (!op.done) {
      if (Date.now() - started > timeoutMs) throw new Error('Veo timed out after 6 minutes.');
      await new Promise((r) => setTimeout(r, 5000));
      op = await ai.operations.getVideosOperation({ operation: op });
    }
    const videos = op.response?.generatedVideos || [];
    if (!videos.length) throw new Error('Veo returned no video.');
    const fileUri = videos[0].video?.uri;
    if (!fileUri) throw new Error('Veo response missing video uri.');

    const fetchRes = await fetch(`${fileUri}&key=${apiKey}`);
    if (!fetchRes.ok) throw new Error(`Veo download failed: ${fetchRes.status}`);
    const buf = Buffer.from(await fetchRes.arrayBuffer());

    const safeHint = (filenameHint || 'creative')
      .replace(/[^a-z0-9-_]+/gi, '-')
      .slice(0, 40);
    const filename = `playtika-${safeHint}-${jobId.slice(0, 6)}.mp4`;
    const mp4Path = path.join(videoDir, filename);
    fs.writeFileSync(mp4Path, buf);

    let sharepoint = null;
    if (isOneDriveConfigured()) {
      try {
        sharepoint = await uploadToSharePoint(buf, filename, 'video/mp4');
        log(`video ${jobId} uploaded to SharePoint: ${sharepoint?.webUrl}`);
      } catch (e) {
        log(`SharePoint upload failed for ${jobId}:`, e?.message);
      }
    }

    videoJobs.set(jobId, {
      ...job,
      status: 'done',
      mp4Path,
      filename,
      model: veoModel,
      sharepoint,
    });
  } catch (err) {
    log(`video job ${jobId} error:`, err?.message);
    videoJobs.set(jobId, { ...job, status: 'error', error: err?.message || 'video failed' });
  }
}

/**
 * POST /api/video — start a video job.
 * Body: { prompt, imageDataUrl?, model?, filenameHint? }
 * Returns: { jobId }
 */
app.post('/api/video', (req, res) => {
  const { prompt, imageDataUrl, model = 'veo-3', filenameHint } = req.body || {};
  if (!prompt && !imageDataUrl) {
    return res.status(400).json({ error: 'prompt or imageDataUrl required' });
  }
  const jobId = randomUUID();
  videoJobs.set(jobId, { status: 'pending', createdAt: Date.now(), prompt });
  // Fire-and-forget; client polls.
  runVideoJob(jobId, { prompt, imageDataUrl, model, filenameHint });
  res.json({ jobId });
});

/** GET /api/video/:jobId — poll status. */
app.get('/api/video/:jobId', (req, res) => {
  const job = videoJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'unknown job' });
  if (job.status === 'done') {
    return res.json({
      status: 'done',
      model: job.model,
      url: `/api/video/${req.params.jobId}/file`,
      sharepoint: job.sharepoint || null,
    });
  }
  if (job.status === 'error') return res.json({ status: 'error', error: job.error });
  res.json({ status: 'pending' });
});

/** GET /api/video/:jobId/file — stream the MP4. */
app.get('/api/video/:jobId/file', (req, res) => {
  const job = videoJobs.get(req.params.jobId);
  if (!job || !job.mp4Path) return res.status(404).end();
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `inline; filename="${job.filename || 'video.mp4'}"`);
  fs.createReadStream(job.mp4Path).pipe(res);
});

app.get('/api/config', (_req, res) => {
  res.json({
    sharepoint: isOneDriveConfigured(),
  });
});

// ── Static frontend (production single-port mode) ─────────────────────────
// When `dist/` exists (after `npm run build`) we serve the built React app
// from the same Express server, so only one port needs to be exposed.

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
  log(`serving static frontend from ${distDir}`);
} else {
  log('no dist/ folder yet — run "npm run build" to enable single-port serve.');
}

// ── Boot ───────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT) || 8787;
app.listen(port, '0.0.0.0', () => log(`listening on http://0.0.0.0:${port}`));
