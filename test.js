import dotenv from 'dotenv';
dotenv.config();

console.log('Key ที่อ่านได้จาก env:', process.env.GEMINI_API_KEY);

import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ หา GEMINI_API_KEY ในไฟล์ .env ไม่เจอ!');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function check() {
  try {
    const response = await ai.models.list();
    console.log('--- รายชื่อ Model ที่ใช้ได้จริง ---');
    for await (const m of response) {
      if (m.name.includes('gemini')) {
        console.log(m.name.replace('models/', ''));
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

check();