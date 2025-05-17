const express = require('express');
const router = express.Router();
const Visit = require('../models/visit.model');
const Patient = require('../models/patient.model');

// GET /api/visits/date/:date - Get all visits for a specific date
router.get('/date/:date', async (req, res) => {
  try {
    const dateParam = req.params.date;
    const date = new Date(dateParam);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    // Get start and end of the day
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    // Find visits for the day, populate patient info and prescription
    const visits = await Visit.find({
      visitDate: { $gte: startOfDay, $lte: endOfDay }
    })
      .populate('patientId', 'name photo image age')
      .populate({ path: 'prescriptionId', populate: { path: 'medicines' } });

    // Map visits to include patient info, doctorNote, and prescription in the format expected by the frontend
    const result = visits.map(visit => ({
      _id: visit._id,
      patientId: visit.patientId._id,
      patientName: visit.patientId.name,
      patientPhoto: visit.patientId.photo || visit.patientId.image || '',
      patientAge: visit.patientId.age, // Added age for doctor dashboard
      reason: visit.reason,
      visitDate: visit.visitDate,
      doctorNote: visit.doctorNote || '',
      prescription: visit.prescriptionId ? {
        _id: visit.prescriptionId._id,
        medicines: visit.prescriptionId.medicines || []
      } : null,
    }));
    res.json(result);
  } catch (err) {
    console.error('Error fetching visits by date:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET latest visit for a patient
const mongoose = require('mongoose'); // Add at top if not present

router.get('/latest/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    console.log('[DEBUG] /latest/:patientId called with:', patientId);
    // Check for valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      console.error('[DEBUG] Invalid patientId:', patientId);
      return res.status(400).json({ error: 'Invalid patientId format' });
    }
    const query = { patientId };
    console.log('[DEBUG] Mongo query:', query);
    const latestVisit = await Visit.findOne(query)
      .sort({ visitDate: -1 })
      .populate({ path: 'prescriptionId', populate: { path: 'medicines' } });
    console.log('[DEBUG] Query result:', latestVisit);
    if (!latestVisit) {
      return res.status(404).json({ error: 'No visits found for this patient' });
    }
    // Format the response as expected by the nurse app
    const formattedVisit = {
      _id: latestVisit._id,
      patientId: latestVisit.patientId,
      visitDate: latestVisit.visitDate,
      vitals: latestVisit.vitals,
      doctorNote: latestVisit.doctorNote || '',
      prescription: latestVisit.prescriptionId
        ? {
            _id: latestVisit.prescriptionId._id,
            medicines: latestVisit.prescriptionId.medicines || []
          }
        : null,
    };
    res.json(formattedVisit);
  } catch (err) {
    console.error('[DEBUG] Server error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// PATCH /api/visits/:visitId - Update doctorNote (title, content) for a visit
router.patch('/:visitId', async (req, res) => {
  try {
    const { visitId } = req.params;
    const { doctorNote } = req.body;

    if (!doctorNote || !doctorNote.title || !doctorNote.content) {
      return res.status(400).json({ error: 'doctorNote {title, content} required' });
    }

    const updatedVisit = await Visit.findByIdAndUpdate(
      visitId,
      { $set: { doctorNote } },
      { new: true }
    );

    if (!updatedVisit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    res.json(updatedVisit);
  } catch (err) {
    console.error('Error updating visit:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// DELETE /api/visits/:visitId - Delete a visit by its ID
const auth = require('../middlewares/auth.middleware');
router.delete('/:visitId', auth, async (req, res) => {
  try {
    const { visitId } = req.params;
    const visit = await Visit.findByIdAndDelete(visitId);
    if (!visit) {
      return res.status(404).json({ success: false, error: 'Visit not found' });
    }
    // Remove this visit from the patient's visits array
    await Patient.updateOne({ _id: visit.patientId }, { $pull: { visits: visitId } });
    res.json({ success: true, message: 'Visit deleted' });
  } catch (error) {
    console.error('Error deleting visit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
