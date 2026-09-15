import mongoose from 'mongoose';

// Schema สำหรับเก็บห้องแชท (Session)
const sessionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: 'New Chat',
    },
  },
  { timestamps: true }
);

// Schema สำหรับเก็บข้อความแชท
const messageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
    },
    sender: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      default: '',
    },
    imageUrls: { type: [String], default: [] }
  },
  { timestamps: true }
);

export const ChatSession = mongoose.model('ChatSession', sessionSchema);
export const ChatMessage = mongoose.model('ChatMessage', messageSchema);