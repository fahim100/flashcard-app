# FlashWords

A vocabulary flashcard app. Add a word, fetch its meaning and synonyms from online, flip cards to study, and quiz yourself with random questions, with or without multiple-choice options. Each user has their own account and cards.

Built with React, Vite, TypeScript, Tailwind CSS and Supabase.

## Features

- **Accounts:** email and password sign-up, sign-in and password reset (Supabase Auth). Each user only sees their own data (Row Level Security).
- **Cards and decks:** add, edit and delete cards; group them into decks; search.
- **Online lookup:** "Fetch from online" fills in the meaning, part of speech, example, pronunciation and synonyms ([Free Dictionary API](https://dictionaryapi.dev) + [Datamuse](https://www.datamuse.com/api/)). Bulk add fetches many words at once.
- **Study:** 3D flip cards, shuffle, keyboard shortcuts, and "Still learning" / "I know it" marks.
- **Quiz:** Word → Meaning, Meaning → Word, or Word → Synonym; with options or typed answers (typed answers allow small typos); results, mistake review, retry wrong answers, and quiz history.

## Setup

1. **Database:** in Supabase open **SQL Editor → New query**, paste [`supabase/setup.sql`](supabase/setup.sql) and click **Run**.
2. **Environment:** `.env` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The anon key is public by design; the security comes from the RLS policies in the SQL file.
3. **Run locally:**

   ```bash
   npm install
   npm run dev
   ```

## Deploy (Vercel)

1. Import this GitHub repo at [vercel.com/new](https://vercel.com/new). Vercel detects Vite automatically.
2. Deploy. `vercel.json` makes page refreshes on routes like `/quiz` work.
3. In Supabase go to **Authentication → URL Configuration** and set **Site URL** to your Vercel URL (for example `https://flashwords.vercel.app`) so email confirmation and password-reset links open the live site.
