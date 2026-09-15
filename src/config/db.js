import mongoose from 'mongoose';
import pc from 'picocolors';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(pc.blue(`MongoDB Connected: ${conn.connection.host}`));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};