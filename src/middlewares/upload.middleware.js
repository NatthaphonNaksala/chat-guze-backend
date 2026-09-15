import multer from 'multer';
import path from 'path';

// กำหนดที่เก็บไฟล์และชื่อไฟล์
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

// 🟢 เพิ่มการจำกัดขนาดไฟล์ (5MB) และเช็กประเภทไฟล์
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // ไม่เกิน 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('รองรับเฉพาะไฟล์รูปภาพเท่านั้น!'));
    }
  },
});

export default upload;