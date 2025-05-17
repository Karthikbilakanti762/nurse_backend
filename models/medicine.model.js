const mongoose = require('mongoose');

const MedicineSchema = new mongoose.Schema({
    name: String,
    dosage: String,
    duration: String,
    instructions: String
});

module.exports = {
    MedicineSchema,
    Medicine: mongoose.model('Medicine', MedicineSchema)
};
