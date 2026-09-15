import mongoose from 'mongoose';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

// ใช้ Model Faq เดิมจาก DB หรือสร้าง Schema อ้างอิง
const faqSchema = new mongoose.Schema({
  question: String,
  answer: String,
  category: String,
  language: String,
  images: [String],
  embedding: [Number]
});

const Faq = mongoose.models.Faq || mongoose.model('Faq', faqSchema);

// 1. แปลงคำถามผู้ใช้เป็น Embedding Vector
async function generateQueryEmbedding(text) {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: {
      outputDimensionality: 768 
    }
  });

  const vector = response.embeddings?.[0]?.values;

  if (!vector) {
    throw new Error('Failed to generate embedding vector for user query.');
  }

  return vector;
}

// 2. ค้นหา FAQ ที่เกี่ยวข้องมากที่สุด และส่ง Context คืนกลับไป
export async function getFaqContext(userQuery) {
  try {
    if (!userQuery || !userQuery.trim()) return '';

    console.log(`\n🔍 Search Vector Query: "${userQuery}"`);

    const queryVector = await generateQueryEmbedding(userQuery);

    const pipeline = [
      {
        $vectorSearch: {
          index: 'faq_vector_index',
          path: 'embedding',
          queryVector: queryVector,
          numCandidates: 10,
          limit: 2
        }
      },
      {
        $project: {
          _id: 0,
          question: 1,
          answer: 1,
          images: 1, // 🟢 ดึง images ออกมาจาก Vector DB
          score: { $meta: 'vectorSearchScore' }
        }
      }
    ];

    const results = await Faq.aggregate(pipeline);

    console.log('--- Vector Search Results ---', results);

    if (!results.length || results[0].score < 0.6) {
      console.log('❌ Score ไม่ถึง Threshold (0.6)');
      return '';
    }

    // 🟢 รวมรายการรูปภาพลงไปใน Context Text
    const context = results
      .map((f, i) => {
        const imageUrls = f.images && f.images.length > 0 ? f.images.join(', ') : 'None';
        return `[FAQ ${i + 1}]\nQuestion: ${f.question}\nAnswer: ${f.answer}\nImages: ${imageUrls}`;
      })
      .join('\n\n');

    return context;
  } catch (error) {
    console.error('Vector Search Error in faq.service:', error);
    return '';
  }
}