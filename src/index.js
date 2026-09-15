import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pc from 'picocolors';
import { connectDB } from './config/db.js';
import chatRoutes from './routes/chat.routes.js';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/chat', chatRoutes);

app.use('/uploads', express.static('uploads'));

app.use('/static', express.static(path.join(process.cwd(), 'public')));

app.get('/', (req, res) => {
  res.send('Backend Chat-GG API is running...');
});

app.listen(PORT, () => {
  console.log(pc.bold(pc.magenta(`Server running on http://localhost:${PORT}`)));
});