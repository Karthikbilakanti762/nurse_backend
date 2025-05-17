const router = require('express').Router();
// Use memory storage for uploads to GridFS
const upload = require('../utils/multerMemory');
const auth = require('../middlewares/auth.middleware');
const { createPatient, getAllPatients, updatePatient, addVisit, updateVisit, addLabReport, deleteLabReport, downloadLabReport, deletePatient, updateLabReportFile } = require('../controllers/patient.controller');


router.get('/', auth, getAllPatients);
router.post('/', auth, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'document', maxCount: 1 },
  { name: 'labReports', maxCount: 10 }
]), createPatient);

// Get patient by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const patient = await require('../models/patient.model').findById(req.params.id)
      .populate('labReports')
      .populate('visits');
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    res.json(patient);
  } catch (error) {
    console.error('Error fetching patient by ID:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch patient', details: error.message });
  }
});

// Delete patient by ID
router.delete('/:id', auth, deletePatient);

// GET /api/patients/:id/visits - Get all visits for a patient (with prescription populated)
const Visit = require('../models/visit.model');
const Prescription = require('../models/prescription.model');

router.get('/:id/visits', auth, async (req, res) => {
  try {
    const visits = await Visit.find({ patientId: req.params.id })
      .populate({
        path: 'prescriptionId',
        populate: { path: 'medicines' }
      });

    const result = visits.map(visit => ({
      _id: visit._id,
      patientId: visit.patientId,
      visitDate: visit.visitDate,
      vitals: visit.vitals,
      doctorNote: visit.doctorNote || '',
      prescription: visit.prescriptionId && visit.prescriptionId.medicines
        ? {
            _id: visit.prescriptionId._id,
            medicines: visit.prescriptionId.medicines
          }
        : null,
    }));

    res.json(result);
  } catch (err) {
    console.error('Error fetching visits for patient:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update patient details
router.put('/:id', auth, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'document', maxCount: 1 },
  { name: 'labReports', maxCount: 10 }
]), updatePatient);

// Add new visit
router.post('/:id/visits', auth, addVisit);
router.put('/visits/:visitId', auth, updateVisit);

// Add new lab report (image + date)
const singleLabReportUpload = upload.single('labReport');

router.post('/:id/lab-reports', auth, singleLabReportUpload, addLabReport);
router.delete('/lab-reports/:reportId', auth, deleteLabReport);

// Download lab report by report ID
router.get('/lab-reports/:reportId/download', auth, downloadLabReport);

// Update lab report file
router.put('/lab-reports/:reportId', auth, singleLabReportUpload, updateLabReportFile);

module.exports = router;
