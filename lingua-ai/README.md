# Lingua AI 🗣️

Practise **speaking** English, French, Italian, Spanish, Arabic and German with an AI conversation partner (Claude).

## Features
- 6 languages: 🇬🇧 English · 🇫🇷 Français · 🇮🇹 Italiano · 🇪🇸 Español · 🇸🇦 العربية (right-to-left) · 🇩🇪 Deutsch
- **Talk with your voice** 🎤: speech-to-text in the chosen language (Chrome, Edge, Safari), or type
- **The AI talks back** 🔊: replies are read aloud (slower for beginners)
- **Corrections after each message** 💡: the corrected sentence, a short explanation and a translation, in *your* language
- 3 levels (Beginner / Intermediate / Advanced) and 6 role-play situations: free chat, café, travel, shopping, doctor, job interview

## Run it locally
```bash
cd lingua-ai
npm install
cp .env.example .env.local   # then put your Anthropic API key in it
npm run dev                  # open http://localhost:3000
```
Get an API key at https://console.anthropic.com.

## Deploy on Vercel
1. Import the repo on Vercel and set **Root Directory** to `lingua-ai`.
2. Add the environment variable `ANTHROPIC_API_KEY`.
3. Deploy.

## How it works
- `app/page.tsx`: the app (setup screen + chat, microphone, speech output)
- `app/api/chat/route.ts`: calls Claude (`claude-opus-5-5`, low effort for quick replies) and streams the answer
- `lib/languages.ts`: languages, levels and situations; add new ones here
