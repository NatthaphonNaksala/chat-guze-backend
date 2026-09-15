import { Router } from 'express';
import { 
    createSession,
    getMessagesBySession,
    getSessions,
    handleChatMessage,
    updateSessionTitle,
    deleteSession       
 } from '../controllers/chat.controller.js';
import upload from '../middlewares/upload.middleware.js';
const router = Router();

    // POST /api/chat/session (สร้างห้องใหม่)
router.post('/session', createSession);   
    // GET  /api/chat/sessions (ดึงประวัติห้อง)               
router.get('/sessions', getSessions);     
    // GET /api/chat/sessions/:id/messages (ดึงข้อความเก่า)               
router.get('/sessions/:sessionId/messages', getMessagesBySession); 
    // POST /api/chat/send (ส่งข้อความ)
router.post('/send', upload.array('images', 5), handleChatMessage);
// PATCH /api/chat/sessions/:sessionId (เปลี่ยนชื่อห้องแชท)
router.patch('/sessions/:sessionId', updateSessionTitle);
    // DELETE /api/chat/sessions/:sessionId (ลบห้องแชท)
router.delete('/sessions/:sessionId', deleteSession);

export default router;