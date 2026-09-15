import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();



const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper แปลงไฟล์รูปในเครื่องเป็นโครงสร้างที่ Gemini อ่านได้
const fileToGenerativePart = (filePath, mimeType) => {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString('base64'),
      mimeType,
    },
  };
};

export const getAIChatResponse = async (userMessage, historyMessages = [], imageFiles = []) => {
  const maxRetries = 3;

  const now = new Date();
  const currentDateStr = now.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Bangkok'
  });

  // 1. แปลงประวัติเก่าจาก DB
  // 🔴 ปรับปรุง: กรองข้อความเก่า ตัดรายการว่าง/เน้นเฉพาะ role และ parts ที่มีข้อมูล เพื่อไม่ให้ Payload พัง
  const formattedHistory = historyMessages
    .filter((msg) => (msg.text && msg.text.trim() !== '') || (msg.imageUrls && msg.imageUrls.length > 0))
    .map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text || 'วิเคราะห์รูปภาพ' }],
    }));

  // 2. จัดเตรียมส่วนประกอบของข้อความปัจจุบัน (Parts)
  const currentParts = [];

  // ถ้ามีข้อความ
  if (userMessage && userMessage.trim() !== '') {
    currentParts.push({ text: userMessage });
  }

  // ถ้าแนบรูปภาพมาด้วย
  if (Array.isArray(imageFiles) && imageFiles.length > 0) {
    imageFiles.forEach((file) => {
      if (fs.existsSync(file.path)) {
        const imagePart = fileToGenerativePart(file.path, file.mimetype);
        currentParts.push(imagePart);
      }
    });
  }

  if (currentParts.length === 0) {
    currentParts.push({ text: 'สวัสดี' });
  }

  // 3. รวมประวัติและข้อความ/รูปภาพปัจจุบัน
  const contents = [
    ...formattedHistory,
    {
      role: 'user',
      parts: currentParts,
    },
  ];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash', 
        config: {
          systemInstruction:
            `You are a helpful and polite customer support AI assistant for GuzeMarkets Broker.
Today's exact date is: ${currentDateStr}.

[CRITICAL IMAGE INSTRUCTION]:
1. When replying with FAQ context that includes image URLs, you MUST directly embed the image URLs using Markdown format: ![description](URL).
2. DO NOT modify, omit, or shorten the image URLs. Return them EXACTLY as provided in the context.
3. Respond in the same language as the user's message (Thai).`,
        },
        contents: contents,
      });

      return response.text;
    } catch (error) {
      /** @type {any} */
      const err = error;
      console.error(`Gemini API Attempt ${attempt} failed:`, err.message);

      if ((err.status === 503 || err.status === 429) && attempt < maxRetries) {
        console.log(`Retrying in ${attempt * 2} second(s)...`);
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        continue;
      }

      throw error;
    }
  }
};

// 🟢 เพิ่มฟังก์ชันนี้ลงไป: สั่ง AI สรุปหัวข้อสั้นๆ สำหรับตั้งชื่อห้องแชท
export const generateChatTitle = async (firstMessageText) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      config: {
        systemInstruction:
          'You are a title generator. Summarize the user message into a very short chat title (2 to 8 words max) in the same language as the user. Do not use quotes, punctations, or long sentences.',
      },
      contents: [{ role: 'user', parts: [{ text: firstMessageText }] }],
    });

    return response.text ? response.text.trim() : firstMessageText.substring(0, 20);
  } catch (error) {
    console.error('Failed to generate title:', error);
    return firstMessageText.length > 20
      ? firstMessageText.substring(0, 20) + '...'
      : firstMessageText;
  }
};
