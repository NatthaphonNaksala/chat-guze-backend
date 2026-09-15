import mongoose from 'mongoose';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { faqDataTh } from '../data/faqs-th.js';
import { faqDataEn } from '../data/faqs-en.js';

dotenv.config();

// เช็คความปลอดภัยของ Environment Variables
const mongoUri = process.env.MONGODB_URI;
const apiKey = process.env.GEMINI_API_KEY;

if (!mongoUri || !apiKey) {
  console.error('❌ Missing MONGODB_URI or GEMINI_API_KEY in .env file');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// Connect MongoDB
mongoose.connect(mongoUri);

// Define Schema
const faqSchema = new mongoose.Schema({
  question: String,
  answer: String,
  category: String,
  language: String,
  images: [String],
  embedding: [Number]
}, { timestamps: true });

const Faq = mongoose.model('Faq', faqSchema);

const allFaqs = [...faqDataTh, ...faqDataEn];

// 🔴 2. ลบ const faqData = [...] ของเดิมออกแล้ว

async function generateEmbedding(text) {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: {
      outputDimensionality: 768 
    }
  });

  const embeddingValues = response.embeddings?.[0]?.values;

  if (!embeddingValues) {
    throw new Error('Failed to generate embedding array from response');
  }

  return embeddingValues;
}

async function importFaqs() {
  try {
    await Faq.deleteMany({});
    console.log(`📌 Found ${allFaqs.length} FAQs across all languages to ingest...`);

    for (const item of allFaqs) {
      // 🟢 ไม่ต้องรวม URL รูปภาพเข้าไปใน Embedding Text เพื่อประมวลผลความหมาย
      const textToEmbed = `Question: ${item.question} Answer: ${item.answer}`;
      const embedding = await generateEmbedding(textToEmbed);

      await Faq.create({
        question: item.question,
        answer: item.answer,
        category: item.category,
        language: item.language,
        images: item.images || [], // 🟢 เซฟ URL รูปภาพลง MongoDB (ถ้าไม่มีให้เป็น [])
        embedding
      });
      console.log(`✅ Saved [${item.language.toUpperCase()}]: ${item.question} (Images: ${item.images?.length || 0})`);
    }

    console.log('--- Import Multi-language FAQs Success! ---');
    process.exit(0);
  } catch (error) {
    console.error('Error importing FAQs:', error);
    process.exit(1);
  }
}

importFaqs();