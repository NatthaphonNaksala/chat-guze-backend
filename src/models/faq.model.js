const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  category: { type: String },
  language: { type: String, default: 'th' },
  images: [{ type: String }],
  embedding: { type: [Number], required: true } 
}, { timestamps: true });

module.exports = mongoose.model('Faq', faqSchema);