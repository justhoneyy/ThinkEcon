# ThinkEconomics

Next.js 16 + Clerk (Google login) + PostgreSQL. Everything on the site is edited from **/admin**.

## Environment variables
| Name | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL 13+ connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | Clerk → API Keys (must exist at **build** time) |
| `CLERK_SECRET_KEY` | yes | Clerk → API Keys |
| `DEFAULT_ADMIN_EMAIL` | no | Defaults to `abhinav.hadaa@gmail.com` |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | no | Upstash cache (preferred, works on Vercel). Or use `REDIS_URL` |
| `REDIS_URL` | no | `redis://` or `rediss://` URL. Public API responses are cached; any admin edit or new comment clears the cache |
| `REDIS_TTL` | no | Cache seconds (default 300) |
| `DATABASE_SSL` | no | Set `false` only if your DB refuses SSL |

Tables are created and seeded automatically on the first request – nothing to run manually.

## Clerk setup
1. Clerk dashboard → **User & Authentication → Social connections** → enable **Google**.
2. Disable email/password and other methods so Google is the only way in.
3. Add your deployed URL(s) to the allowed origins/redirects if Clerk asks.

## Run locally
```
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

## Deploy
**Vercel:** import the repo → add the 3 variables → Deploy. (Use a pooled connection string with Neon/Supabase.)
**Render:** New → Blueprint (uses `render.yaml`, creates DB + service) → fill the two Clerk keys.
Or manually: Build `npm install && npm run build`, Start `npm start`.

## Admin panel (`/admin`)
Journal, Podcasts, Events, Discussion page, Community posts (threads/replies/comments), Heads, Home/About/Contact/Footer text, Contact messages, Admins.
Images can be uploaded (stored in PostgreSQL, max 4 MB) or pasted as URL / Unsplash id.
Article text supports Markdown, `image:URL`, `interactive:supply`, `interactive:growth`; `.md`/`.pdf` import included.

## Source visibility
The server sends an **empty HTML shell**; the site renders in the browser from minified, hashed bundles with **no source maps**.
Browsers must download the code to run it, so it can never be made truly invisible, only unreadable. Real secrets (DB, Clerk secret) never reach the browser.

## Project layout
```
app/layout.tsx     root layout
app/page.tsx       the only page – serves every URL (router is in site.tsx, rewrite in next.config.ts)
app/api/route.ts   the only API route, called as /api?p=<name>
app/site.tsx  admin.tsx  admin-entry.tsx  pub.ts  adm.ts  db.ts  auth.ts  *.css
proxy.ts           Clerk middleware
```
