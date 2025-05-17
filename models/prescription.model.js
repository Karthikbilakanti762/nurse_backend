const mongoose = require('mongoose');
const { MedicineSchema } = require('./medicine.model');

const PrescriptionSchema = new mongoose.Schema({
    medicines: [MedicineSchema]
});

module.exports = mongoose.model('Prescription', PrescriptionSchema);
