const axios = require('axios');
const FormData = require('form-data');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL;

/**
 * Uses Groq's vision model to verify the uploaded image actually shows a skin lesion.
 * Returns { valid: boolean, reason: string }
 */
const validateSkinLesionImage = async (imageBuffer, contentType) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return { valid: true }; // Skip validation if key missing

    // Convert image buffer to base64
    const base64Image = imageBuffer.toString('base64');
    const mimeType = contentType || 'image/jpeg';

    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const response = await axios.post(url, {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
            {
              type: 'text',
              text: `You are a medical image validation assistant for a dermatology app.
Examine this image carefully and determine if it shows a human skin lesion, mole, rash, or any skin condition suitable for dermatological analysis.

Answer ONLY in this exact JSON format (no extra text):
{"is_skin_lesion": true/false, "reason": "brief reason in one sentence"}

Consider it a valid skin lesion image if it shows:
- A mole, nevus, or pigmented spot on skin
- A rash, lesion, or abnormal skin area
- Any skin condition close up on a human body

Consider it INVALID if it shows:
- Animals, food, objects, or scenery
- A full body portrait or face (not focusing on a skin lesion)
- Blurry images where no skin is visible
- Screenshots, documents, or computer screens`,
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 100,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 20000,
    });

    if (response.data?.choices?.length > 0) {
      const raw = response.data.choices[0].message.content.trim();
      // Extract JSON from the response (sometimes the model wraps it in markdown)
      const jsonMatch = raw.match(/\{.*\}/s);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { valid: parsed.is_skin_lesion === true, reason: parsed.reason };
      }
    }
  } catch (err) {
    console.error('Vision validation error:', err.response?.data || err.message);
    // On validation error, allow the request through so we don't block legitimate users
  }
  return { valid: true };
};

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

    const imageBuffer = Buffer.from(imageResponse.data);
    const contentType = imageResponse.headers['content-type'] || 'image/jpeg';

    // 2. Validate: is this actually a skin lesion image?
    const validation = await validateSkinLesionImage(imageBuffer, contentType);
    if (!validation.valid) {
      return res.status(422).json({
        message: 'invalid_image',
        detail: validation.reason || 'The uploaded image does not appear to show a skin lesion.',
      });
    }

    // 3. Build multipart form-data for the AI service
    const form = new FormData();
    const filename = req.file.originalname || 'image.jpg';
    form.append('image', imageBuffer, {
      filename,
      contentType,
    });

    // 4. Forward to AI service /predict
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/predict`, form, {
      headers: form.getHeaders(),
      timeout: 60000, // ResNet101 CPU inference can take a few seconds
    });

    let { risk_level, confidence, explanation, recommendation, class_name } =
      aiResponse.data;

    // 5. Generate dynamic doctor explanation using LLM
    const dynamicExplanation = await generateDoctorExplanation(class_name, risk_level, confidence);
    if (dynamicExplanation) {
      explanation = dynamicExplanation;
    }

    // 6. Return structured result + the Cloudinary URL so the app can save it
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
