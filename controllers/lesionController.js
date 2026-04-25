const Lesion = require('../models/Lesion');

// @desc    Get all lesions for the logged in user
// @route   GET /api/lesions
// @access  Private
const getLesions = async (req, res) => {
  try {
    const lesions = await Lesion.find({ userId: req.user.id });
    res.json(lesions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new lesion profile
// @route   POST /api/lesions
// @access  Private
const createLesion = async (req, res) => {
  try {
    const { name, bodyLocation, notes } = req.body;
    
    if (!name || !bodyLocation) {
      return res.status(400).json({ message: 'Please provide name and body location' });
    }

    const lesion = await Lesion.create({
      userId: req.user.id,
      name,
      bodyLocation,
      notes,
    });
    
    if (req.body.initialScan) {
      lesion.scanHistory.push(req.body.initialScan);
      lesion.latestRisk = req.body.initialScan.riskLevel;
      lesion.lastScan = req.body.initialScan.date || Date.now();
      lesion.firstDetected = req.body.initialScan.date || Date.now();
      await lesion.save();
    }
    
    res.status(201).json(lesion);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a scan/analysis to a lesion
// @route   POST /api/lesions/:id/scans
// @access  Private
const addScanToLesion = async (req, res) => {
  try {
    const lesion = await Lesion.findById(req.params.id);
    
    if (!lesion) return res.status(404).json({ message: 'Lesion not found' });
    if (lesion.userId.toString() !== req.user.id) return res.status(401).json({ message: 'User not authorized' });
    
    // In a real app, send the image to an AI python microservice or model here.
    // For now, generate the mock risk level.
    const riskLevels = ['low', 'medium', 'high'];
    const results = [
      {
        riskLevel: 'low',
        confidence: 0.88 + (Math.random() * 0.10),
        explanation: 'The lesion displays uniform pigmentation with well-defined, symmetrical borders. No irregular features or color variegation detected.',
        recommendation: 'Continue regular self-monitoring every 3 months. Apply broad-spectrum SPF 50+ sunscreen daily.',
      },
      {
        riskLevel: 'medium',
        confidence: 0.70 + (Math.random() * 0.15),
        explanation: 'Slight asymmetry observed in the lesion border. Mild color variation is present within the lesion boundary.',
        recommendation: 'Schedule a dermatologist appointment within the next 2–4 weeks for a professional evaluation.',
      },
      {
        riskLevel: 'high',
        confidence: 0.60 + (Math.random() * 0.20),
        explanation: 'Multiple irregular features detected: asymmetrical borders, heterogeneous coloring with dark regions. Consistant with higher-risk lesion patterns.',
        recommendation: '⚠️ Seek immediate medical attention. Contact a board-certified dermatologist as soon as possible.',
      }
    ];

    const randomIndex = Math.floor(Math.random() * results.length);
    const analysisResult = results[randomIndex];
    
    const newScan = {
      ...analysisResult,
      imagePath: req.file ? `/uploads/${req.file.filename}` : null
    };

    lesion.scanHistory.push(newScan);
    lesion.latestRisk = newScan.riskLevel;
    lesion.lastScan = Date.now();
    await lesion.save();

    res.status(201).json({ lesion, scan: newScan });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getLesions,
  createLesion,
  addScanToLesion,
};
