const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Mongoose 8 uses these defaults, but being explicit
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

mongoose.connection.on('connected', async () => {
  try {
    await mongoose.connection.collection('users').dropIndex('email_1');
    console.log('🗑️ Dropped old email index');
  } catch (e) {
    console.log('ℹ️ No email index to drop, continuing');
  }
});

module.exports = connectDB;
