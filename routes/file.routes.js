// routes/file.routes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getGridFSBucket } = require('../utils/gridfs');

// GET /files/:id - stream file from GridFS
router.get('/:id', async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const bucket = getGridFSBucket();
    // Find file metadata
    const files = await bucket.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    const file = files[0];
    res.set('Content-Type', file.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);
    const readStream = bucket.openDownloadStream(fileId);
    readStream.on('error', err => {
      res.status(500).json({ success: false, error: 'Error streaming file', details: err.message });
    });
    readStream.pipe(res);
  } catch (err) {
    res.status(400).json({ success: false, error: 'Invalid file id', details: err.message });
  }
});

module.exports = router;
