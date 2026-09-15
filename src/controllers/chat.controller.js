import { generateChatTitle, getAIChatResponse } from '../services/openai.service.js';
import { ChatMessage, ChatSession } from '../models/chat.model.js';
import { getFaqContext } from '../services/faq.service.js';

// 1. สร้าง Session ห้องแชทใหม่
export const createSession = async (req, res) => {
  try {
    const session = await ChatSession.create({ title: 'New Chat' });
    return res.status(201).json(session);
  } catch (error) {
    console.error('Create Session Error:', error);
    return res.status(500).json({ error: 'ไม่สามารถสร้างห้องแชทได้' });
  }
};

// 2. ดึงรายการ Session ทั้งหมดไปโชว์ที่ Sidebar
export const getSessions = async (req, res) => {
  try {
    const sessions = await ChatSession.find().sort({ updatedAt: -1 });
    return res.status(200).json(sessions);
  } catch (error) {
    console.error('Get Sessions Error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงประวัติห้องแชทได้' });
  }
};

// 3. ดึงข้อความเก่าทั้งหมดของ Session นั้นๆ
export const getMessagesBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await ChatMessage.find({ sessionId }).sort({ createdAt: 1 });
    return res.status(200).json(messages);
  } catch (error) {
    console.error('Get Messages Error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงข้อความแชทได้' });
  }
};

// 4. ส่งข้อความแชท (เซฟลง DB + ส่ง AI + เซฟคำตอบ AI)
export const handleChatMessage = async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    const imageFiles = req.files || [];
    const userMessage = String(message || '');
    const cleanSessionId = String(sessionId || '');

    if (!sessionId) {
      return res.status(400).json({ error: 'กรุณาระบุ sessionId' });
    }

    const imageUrls = imageFiles.map(file => `/uploads/${file.filename}`);

    await ChatMessage.create({
      sessionId: cleanSessionId,
      sender: 'user',
      text: userMessage,
      imageUrls: imageUrls,
    });

    const messageCount = await ChatMessage.countDocuments({ sessionId: cleanSessionId });
    if (messageCount === 1) {
      const titlePrompt = userMessage.trim() !== '' ? userMessage : 'วิเคราะห์รูปภาพ';
      const generatedTitle = await generateChatTitle(titlePrompt);
      await ChatSession.findByIdAndUpdate(cleanSessionId, { title: generatedTitle });
    }

    const faqContext = await getFaqContext(userMessage);

    // ถ้าเจอ FAQ Context ให้เอาไปต่อเสริมไว้กับ prompt ข้อความของผู้ใช้
let finalPrompt = userMessage;
    if (faqContext) {
      finalPrompt = `คุณคือแอดมินผู้ช่วยบริการลูกค้า โปรดนำข้อมูลจาก FAQ ด้านล่างนี้ไปเรียบเรียงเป็นคำตอบที่สุภาพ สดใส เป็นธรรมชาติ และเข้าใจง่าย และมีคำคมสั้นๆที่คล้องจองตอนท้ายคำตอบฮาๆให้ลูกค้า (อิโมจิอย่าใช้เยอะ) 

[ข้อกำหนดสำคัญเกี่ยวกับรูปภาพ]: 
หากใน [ข้อมูล FAQ อ้างอิง] มีฟิลด์ Images ที่ระบุ URL รูปภาพ (ที่ไม่ใช่ None) คุณ **ต้อง** นำ URL รูปภาพนั้นมาใส่ในรูปแบบ Markdown ติดกันห้ามขึ้นบรรทัดใหม่เด็ดขาด เช่น ![รูปประกอบ](URL_HERE)

[ข้อมูล FAQ อ้างอิง]: 
${faqContext} 

คำถามของผู้ใช้: ${userMessage}`;
    }

    let aiReplyText = '';
    try {
      const history = await ChatMessage.find({ sessionId: cleanSessionId }).sort({ createdAt: 1 });
      aiReplyText = (await getAIChatResponse(finalPrompt, history, imageFiles)) || '';
    } catch (aiError) {
      console.error('AI Response Error:', aiError);
      aiReplyText = 'ขณะนี้ระบบ AI ไม่สามารถวิเคราะห์ได้ กรุณาลองใหม่อีกครั้ง';
    }

    // 🟢 2. ปรับ Regex ให้รองรับการขึ้นบรรทัดใหม่ระหว่าง ] และ ( เผื่อ AI หลุด
    const extractedImageUrls = [];
    const imageMarkdownRegex = /!\[[\s\S]*?\][\s\n]*\([\s\n]*(https?:\/\/[^\s\)]+)[\s\n]*\)/g;
    let match;

    while ((match = imageMarkdownRegex.exec(aiReplyText)) !== null) {
      extractedImageUrls.push(match[1]);
    }

    // 🟢 3. ลบ Markdown รูปภาพออกจาก aiReplyText เพื่อไม่ให้แสดงเป็น Text ค้างใน Bubble แชท
    const cleanText = aiReplyText.replace(imageMarkdownRegex, '').trim();

    // 4. บันทึกคำตอบ AI ลง DB
    const botMessage = await ChatMessage.create({
      sessionId: cleanSessionId,
      sender: 'bot',
      text: cleanText, // 👈 บันทึกข้อความที่ถูกคลีนเอา Markdown รูปออกแล้ว
      imageUrls: extractedImageUrls
    });

    await ChatSession.findByIdAndUpdate(cleanSessionId, { updatedAt: new Date() });

    return res.status(200).json({
      reply: cleanText, // 👈 ส่งข้อความคลีนกลับไปที่ Frontend
      botMessage,
    });
  } catch (error) {
    console.error('Chat Controller Error:', error);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการส่งข้อความ' });
  }
};

// 5. เปลี่ยนชื่อหัวข้อห้องแชท (Rename Session)
export const updateSessionTitle = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'กรุณาระบุชื่อหัวข้อ' });
    }

    const updatedSession = await ChatSession.findByIdAndUpdate(
      sessionId,
      { title: title.trim(), updatedAt: new Date() },
      { new: true }
    );

    if (!updatedSession) {
      return res.status(404).json({ error: 'ไม่พบห้องแชทที่ต้องการแก้ไข' });
    }

    return res.status(200).json(updatedSession);
  } catch (error) {
    console.error('Update Session Title Error:', error);
    return res.status(500).json({ error: 'ไม่สามารถเปลี่ยนชื่อห้องแชทได้' });
  }
};

// 6. ลบห้องแชทและข้อความทั้งหมดในห้องนั้น (Delete Session)
export const deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // ลบทั้ง Session และข้อความทั้งหมดใน Session นั้น
    await ChatSession.findByIdAndDelete(sessionId);
    await ChatMessage.deleteMany({ sessionId });

    return res.status(200).json({ message: 'ลบห้องแชทเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Delete Session Error:', error);
    return res.status(500).json({ error: 'ไม่สามารถลบห้องแชทได้' });
  }
};