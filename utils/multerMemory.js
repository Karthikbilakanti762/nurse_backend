// utils/multerMemory.js
const multer = require('multer');

// Use memory storage so we can write directly to GridFS
const storage = multer.memoryStorage();

const upload = multer({ storage });

module.exports = upload;
