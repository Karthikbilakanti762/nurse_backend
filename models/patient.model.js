const mongoose = require('mongoose');


const PatientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true },
  phone: { type: String },
  image: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files' }, // GridFS file id
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files' }, // GridFS file id

  visits: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Visit' }],
  labReports: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LabReport' }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Patient', PatientSchema);
