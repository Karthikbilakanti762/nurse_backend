const mongoose = require('mongoose');

const LabReportSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  testName: String,
  testDate: { type: Date, default: Date.now },
  result: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files' }, // GridFS file id for report file
  visitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit' }
});

module.exports = mongoose.model('LabReport', LabReportSchema);
