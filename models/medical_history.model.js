const mongoose = require('mongoose');

const MedicalHistorySchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  conditions: [String],
  allergies: [String],
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' }
});

module.exports = mongoose.model('MedicalHistory', MedicalHistorySchema);
