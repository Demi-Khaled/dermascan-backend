// @desc    Analyze an image without permanently saving to a specific lesion yet
// @route   POST /api/analyze
// @access  Private
const analyzeImage = async (req, res) => {
  try {
    const riskLevels = ['low', 'medium', 'high'];
    const results = [
      {
        risk_level: 'low',
        confidence: 0.88 + (Math.random() * 0.10),
        explanation: 'The lesion displays uniform pigmentation with well-defined, symmetrical borders.',
        recommendation: 'Continue regular self-monitoring every 3 months. Apply sun screen.',
      },
      {
        risk_level: 'medium',
        confidence: 0.70 + (Math.random() * 0.15),
        explanation: 'Slight asymmetry observed in the lesion border. Mild color variation is present.',
        recommendation: 'Schedule a dermatologist appointment within the next 2–4 weeks.',
      },
      {
        risk_level: 'high',
        confidence: 0.60 + (Math.random() * 0.20),
        explanation: 'Multiple irregular features detected: asymmetrical borders, heterogeneous coloring.',
        recommendation: '⚠️ Seek immediate medical attention.',
      }
    ];

    const randomIndex = Math.floor(Math.random() * results.length);
    const analysisResult = results[randomIndex];
    
    // Pass back the image server URL so the frontend can save it to a Lesion later
    const responsePayload = {
        ...analysisResult,
        imagePath: req.file ? `/uploads/${req.file.filename}` : null
    };

    setTimeout(() => {
        res.status(200).json(responsePayload);
    }, 2000); // simulate the AI delay

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  analyzeImage
};
