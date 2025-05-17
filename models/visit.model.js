const mongoose = require('mongoose');

const VitalsSchema = new mongoose.Schema({
    heartRate: Number,
    bloodPressure: String,
    temperature: Number,
    respirationRate: Number,
    weight: Number
}, { _id: false });

const VisitSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    visitDate: Date,
    vitals: VitalsSchema,
    doctorNote: { title: String, content: String },
    prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' }
});

module.exports = mongoose.model('Visit', VisitSchema);
