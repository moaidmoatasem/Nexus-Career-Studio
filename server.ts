import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { handleApiRoute } from './src/server/apiRouter';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(async (req, res, next) => {
  if (req.url.startsWith('/api')) {
    const handled = await handleApiRoute(req, res);
    if (handled) return;
  }
  next();
});

// Serve static assets in production
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cherenkov Nexus Career Studio server listening on port ${PORT}`);
});
