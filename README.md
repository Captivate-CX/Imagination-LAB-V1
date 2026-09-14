# Captivate Imagination Lab

Upload a campaign key visual, get a shopper POSM tool kit.

1. **Upload** the key visual (KV) and choose the POSM types (Wobbler, FSDU, and any you add).
2. **Generate.** Each POSM prompt runs three times independently on a Gemini image model.
3. **Quality check.** A Gemini 3.1 Pro agent compares the three designs with the KV, picks the best, and lists issues. You can override its pick or regenerate.
4. **Tool kit.** The picks become a PDF on the Imagination Lab template: cover, key visual, one page per POSM type, closing page. Preview it in the browser and download it.

Projects are deleted automatically after 30 days.

This is a proof of concept for a three-person team. There are no user accounts, only an optional shared password.

---

## Setting it up (about 20 minutes)

You need: a GitHub account, a Vercel account (Pro plan recommended, because Hobby is for non-commercial use only), and a Google AI Studio API key.

### 1. Put the code on GitHub

The easiest way is **GitHub Desktop** (desktop.github.com):

1. Unzip `imagination-lab.zip`.
2. In GitHub Desktop, choose **File > Add local repository** and pick the unzipped `imagination-lab` folder. It's already a Git repository with one commit.
3. Click **Publish repository**. Keep **Private** ticked, choose your organisation, then publish.

### 2. Create the Vercel project

1. In Vercel, choose **Add New > Project** and import the `imagination-lab` repository. Vercel detects Next.js, so leave the build settings as they are.
2. Before you deploy, open **Environment Variables** and add:

| Name | Value |
| --- | --- |
| `GEMINI_API_KEY` | Your Google AI Studio API key |
| `APP_PASSWORD` | A shared password for the team (recommended, see below) |
| `MOCK_AI` | `true` for a free dry run first, then change it to `false` |

3. Click **Deploy**. The first deploy will say storage isn't connected. That's expected, so carry on to step 3.

### 3. Connect file storage

1. In the Vercel project, open **Storage > Create Database > Blob**.
2. Set access to **Private**, name it (for example `imagination-lab-files`), and connect it to the project for **Production** and **Preview**.
3. Open **Deployments**, then click **⋯ > Redeploy** on the latest deployment.

Everything is stored in this Blob store: key visuals, generated designs, PDFs, and the prompt library. Private access means client work can't be opened by anyone who guesses a link; the app serves files only through itself.

### 4. First run

1. Open the site and enter the password if you set one. Any username works.
2. With `MOCK_AI=true`, create a test tool kit. The "designs" are coloured crops of the key visual and no Gemini credit is used. This checks that storage, the PDF and the whole flow work.
3. Set `MOCK_AI` to `false` (Settings > Environment Variables) and redeploy.
4. Go to **Prompt library > Models and settings** and click **Load the model names available to your Gemini key**. Confirm that the image model and quality check model are in the list, or pick others.

---

## Using it

### Studio (home page)
Enter the brand and campaign name (they appear on the PDF cover), drop in the KV, tick the POSM types, and click **Generate designs**. The project opens and generation starts straight away.

### Project page
- Designs appear as they finish. All of them run in parallel, and each takes roughly 30 to 90 seconds.
- **Keep the tab open until generation finishes.** Your browser drives the steps, and the page warns you if you try to close it mid-run. If something is interrupted, click **Generate missing designs** and it carries on from where it stopped.
- The quality agent's pick gets a yellow **Chosen** sticker. Click any other design to choose it instead. The verdict and **issues table** sit under each row.
- **Regenerate all 3** replaces a whole row and re-runs the check. A failed design shows its error and a **Try again** button.
- **Tool kit:** choose **Chosen design only** or **All designs, chosen in the middle** (like the sample PDF), then click **Build tool kit PDF**. If you change a pick later, the page tells you the PDF is out of date.

### Prompt library
- **POSM types:** edit a prompt, name, or aspect ratio, and add reference files such as blank unit drawings. Every generation uses the latest *saved* prompts.
- **Add POSM type:** give it a name and an aspect ratio, and start from a copy of an existing prompt if you like.
- **Quality agent:** one prompt covers every POSM type. `{brand}`, `{campaign}`, `{asset_type}` and `{design_count}` are filled in automatically.
- **Models and settings:** choose the models, image size (2K by default), and designs per POSM type (3 by default).
- **Saved versions:** every save keeps the previous version, up to the last 40, plus the original starting prompts. **Restore** rolls back.

**Aspect ratio is set on the model, not by the prompt.** The prompts still say "configure your generation tool to use 1:1". That's harmless, but the app sets the ratio directly through the API, which is more reliable.

---

## Things to know

- **Models.** Gemini 3.1 Pro can read images but can't create them. Designs are made by `gemini-3-pro-image-preview` (Nano Banana Pro), and the quality check uses `gemini-3.1-pro-preview`. Google renames preview models from time to time; if generation starts failing with "model not found", use **Load the model names…** to pick the current one.
- **Cost per tool kit** is roughly (number of POSM types × 3) image generations plus one quality-check call per POSM type. The home page shows the count before you start. 4K images cost more and take longer.
- **Time limit.** Each image request can run for up to 5 minutes. At 4K, very complex prompts can occasionally hit that limit. 2K avoids it.
- **Password.** Without `APP_PASSWORD`, anyone with the link can generate on your Gemini account. The daily clean-up job skips the password, and you can protect it by setting `CRON_SECRET` to any random string; Vercel sends it automatically.
- **Retention.** A daily job at 03:00 UTC deletes projects older than 30 days (set `RETENTION_DAYS` to change this). Expired projects also disappear from the list immediately.
- **Heading font.** Your template uses Congenial Black, a licensed Microsoft font that can't be included here. The app uses Fredoka Bold, the closest free match. To use Congenial, replace `assets/fonts/Heading.ttf` with your `.ttf` file (same file name), if your licence allows embedding.
- **PDF template.** `assets/template/til-template.pdf` is your sample tool kit with its text and example images removed (page 1 cover, page 2 inner page, page 3 closing page). To restyle the PDF, replace this file with a new three-page 960 × 540 pt PDF in the same order.
- **Test mode.** `MOCK_AI=true` lets you try interface changes without spending credit.

---

## For your developer partner

- **Stack:** Next.js 16 (App Router, TypeScript) on Vercel, `@google/genai` for Gemini, `@vercel/blob` (private) for all storage, `pdf-lib` for the PDF, and `sharp` for image handling. There is no database: project state is small JSON files in Blob, one file per design, check and selection, so parallel requests never overwrite each other.
- **Pipeline:** the browser runs up to 6 requests at a time, one per design: `POST /api/projects/:id/generate {assetId, n}`. When a row finishes it calls `/qc`, and then `/toolkit` builds the PDF. Each call is a single function invocation with `maxDuration = 300`. For a production version, move the orchestration to a durable server-side job (for example Vercel Workflow or a queue) so closing the tab doesn't pause the run.

| Path | What it does |
| --- | --- |
| `src/lib/defaults.ts` | Starting prompts (used until the library is first saved) |
| `src/lib/gemini.ts` | Image generation, quality check (JSON schema output), model list |
| `src/lib/projects.ts` | Project storage and the generate / check / choose / build steps |
| `src/lib/pdf.ts` | Tool kit PDF layout |
| `src/lib/storage.ts` | Vercel Blob wrapper; falls back to `./.data` locally |
| `src/components/Workspace.tsx` | Project page and pipeline orchestration |
| `src/components/PromptLibrary.tsx` | Prompt library editor |
| `src/proxy.ts` | Optional shared password |
| `src/app/api/cron/cleanup` | Daily 30-day clean-up (scheduled in `vercel.json`) |

**Running locally:**

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY, or set MOCK_AI=true
npm run dev                  # http://localhost:3000
```

Without Blob credentials, files are saved to `./.data`. To use the real Blob store, run `vercel link` and then `vercel env pull .env.local`.
