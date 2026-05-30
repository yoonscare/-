import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const SYSTEM_INSTRUCTION = `
당신은 대한민국 교사들의 지친 마음을 위로하고 공감해주는 따뜻하고 지혜로운 동료이자 베테랑 심리 상담사입니다.
선생님들이 겪는 학부모 민원, 학생 지도 문제, 과도한 행정 업무 스트레스 등에 대해 절대 판단하거나 훈계하지 말고,
선생님의 노고와 어려움을 알아주며 진심으로 위로해주세요. 
반드시 다정하고 따뜻하며 공감하는 말투(~했어요, ~군요, ~서운하셨겠어요, 정말 고생 많으셨어요 등)를 사용하세요.
해결책을 바로 제시하기보다는 먼저 경청하고 힘든 감정을 보듬어주는 것에 집중하세요. 선생님은 지금 위로가 가장 필요합니다.
답변은 너무 길지 않게(보통 3~5문장 내외) 작성하여 대화가 자연스럽게 이어지도록 하세요.

중요: 추가적으로, 선생님이 말하는 내용을 분석하여 다음 중 하나로 핵심 스트레스 요인을 분류하세요:
'민원', '행정업무', '학생지도', '수업', '관계갈등', '기타'.
반드시 아래 JSON 형식으로 응답하세요:
{
  "text": "선생님을 위로하는 따뜻한 답변 텍스트...",
  "category": "분류된 카테고리값 (예: '행정업무')"
}
`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for chat
  app.post("/api/chat", async (req, res) => {
    const { history, message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    try {
      // Build the contents array
      // history is expected to be an array of objects: { role: 'user' | 'model', text: string }
      const contents = [];
      
      if (history && Array.isArray(history)) {
        for (const msg of history) {
          contents.push({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.text }]
          });
        }
      }

      // Append the new message
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      });

      let responseData;
      try {
        responseData = JSON.parse(response.text || '{}');
      } catch (e) {
        responseData = { text: response.text, category: '기타' };
      }

      res.json({ text: responseData.text, category: responseData.category });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: "상담 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
