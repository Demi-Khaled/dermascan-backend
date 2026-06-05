const axios = require('axios');
const FormData = require('form-data');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL;

// Helper function to generate a dynamic doctor-like explanation
const generateDoctorExplanation = async (className, riskLevel, confidence) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;
    
    const formattedName = className ? className.replace(/_/g, ' ') : 'an unknown condition';
    const percent = confidence ? (confidence * 100).toFixed(1) : 'unknown';

    const prompt = `You are a professional, empathetic dermatologist analyzing a skin scan for a patient. 
The AI image classifier has just processed their scan and detected the following:
- Condition: ${formattedName}
- Risk Level: ${riskLevel}
- AI Confidence: ${percent}%

Act as a doctor and write a professional, compassionate explanation of these results directly addressing the patient. 
Introduce the result clearly (e.g., "Based on your scan..."). Explain what this condition typically means in simple, reassuring terms.
Keep it concise (3-4 sentences maximum). 
Crucial: Remind them that this is an AI screening and not a definitive medical diagnosis.`;

    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const response = await axios.post(url, {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 250,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      }
    });

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content;
    }
  } catch (err) {
    console.error('Error generating LLM explanation:', err.response ? err.response.data : err.message);
  }
  return null;
};

// @desc    Analyze an image using the Python AI service
// @route   POST /api/analyze
// @access  Private
const analyzeImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    if (!AI_SERVICE_URL) {
      return res.status(503).json({ message: 'AI service is not configured.' });
    }

    // req.file.path = Cloudinary URL after upload
    const cloudinaryUrl = req.file.path;

    // 1. Download the image bytes from Cloudinary
    const imageResponse = await axios.get(cloudinaryUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
    });

    // 2. Build multipart form-data for the AI service
    const form = new FormData();
    const filename = req.file.originalname || 'image.jpg';
    form.append('image', Buffer.from(imageResponse.data), {
      filename,
      contentType: imageResponse.headers['content-type'] || 'image/jpeg',
    });

    // 3. Forward to AI service /predict
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/predict`, form, {
      headers: form.getHeaders(),
      timeout: 60000, // ResNet101 CPU inference can take a few seconds
    });

    let { risk_level, confidence, explanation, recommendation, class_name } =
      aiResponse.data;

    // 4. Generate dynamic doctor explanation using LLM
    const dynamicExplanation = await generateDoctorExplanation(class_name, risk_level, confidence);
    if (dynamicExplanation) {
      explanation = dynamicExplanation;
    }

    // 5. Return structured result + the Cloudinary URL so the app can save it
    return res.status(200).json({
      risk_level,
      confidence,
      explanation,
      recommendation,
      class_name,
      imagePath: cloudinaryUrl,
    });

  } catch (error) {
    // Surface AI service errors clearly
    if (error.response) {
      console.error('AI service error:', error.response.status, error.response.data);
      return res.status(502).json({
        message: 'AI service returned an error.',
        detail: error.response.data,
      });
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({ message: 'AI service is unreachable.' });
    }
    console.error('analyzeImage error:', error.message);
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { analyzeImage };
