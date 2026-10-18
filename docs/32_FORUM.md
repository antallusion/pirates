# 32 · The forum (owner's brief, 2026-10-18)

> Numbering: `32_PREMIUM_SHOP.md` already holds the number; the brief named this file `32_FORUM.md`, so both stay.

A community forum inside the website (`/site/forum/`, EN `/site/en/forum/`): the site's header, footer, fonts and
components; the game account is the forum account. No build step, no runtime dependencies: a vanilla TypeScript
single-page client served by the game's static handler (types stripped on the fly), a JSON API on the game server, its
own SQLite file next to the game's database.

## 1. Design tokens

All tokens live in `site/css/site.css` (`--bg #07090f`, `--card #0e1320`, `--gold1/--gold2`, `--ice #8cc3e8`, `--r 18px`,
`--r-lg 24px`, `--display` Cormorant SC, `--sans` Geologica). `site/css/forum.css` only adds the forum's own:

| Token | Use |
|---|---|
| `--c-corsair #e0894a`, `--c-reaver #d0574e`, `--c-smuggler #93c46d`, `--c-navigator #58a8e8`, `--c-drowned #3fc1a5`, `--c-admiral #a888e8` | a captain class: character name, the post's left stripe, class icons |
| `--c-admin #ff5f6d`, `--c-mod #e86fb5` | administration and moderators (stripe, role badge) |
| `--c-official` = `--gold1` | an official answer: gold stripe and glow |

Gold is the one accent (buttons, active page coin, nicknames, dates, numbers); ice blue is for links and kickers.

## 2. Files

| File | What |
|---|---|
| `shared/src/typo.ts` | the typography (moved from `tools/site/typo.ts`, which re-exports it) |
| `shared/src/forum/markdown.ts` | the strict Markdown renderer (server and the editor's preview), mention and link scans |
| `shared/src/forum/meta.ts` | ranks, reactions, classes, sections' icons — shared by server and client |
| `client/src/lang/forum.ts` | every UI string, RU and EN |
| `client/src/forum/*.ts` | the page: `main.ts` (router), `core.ts` (API, i18n, time), `parts.ts` (cards), `pages.ts`, `editor.ts` |
| `site/forum/index.html`, `site/en/forum/index.html` | the shells (written by `tools/site/build.ts`: same header, hero, footer) |
| `site/css/forum.css` | forum-only styles |
| `server/src/forum/store.ts` | the SQLite store (`forum.db` beside `DB_PATH`) |
| `server/src/forum/service.ts` | rules: permissions, rate limits, anti-spam, notifications, the game link |
| `server/src/http/forum-routes.ts` | the JSON API under `/api/forum/…`, the uploads |
| `tests/forum.test.ts`, `tests/forum-md.test.ts` | store, permissions, XSS, limits, i18n |

## 3. Routes of the page (path routing; the static handler answers every `/site/forum/*` and `/site/en/forum/*` without a file extension with the shell)

| Path | Page |
|---|---|
| `` | home: stat tiles, categories with sections, fresh topics (right column; a swipe strip on phones) |
| `s/<slug>[?p=N]` | section: pinned, official and hot topics, paginator |
| `t/<id>[?p=N][#p<postId>]` | topic: post cards, paginator top and bottom, the reply editor |
| `p/<postId>` | a post's address: resolves to its topic page and anchor |
| `new/<slug>` | new topic; `edit/<postId>` edit a post (and the title, for the first post) |
| `u/<id>`, `u/@<name>` | profile: avatar, rank, character, guild, stats, recent posts, achievements, «Написать» |
| `g/<tag>` | guild: members with class icons, Russian rank names, achievements |
| `m`, `m/<userId>` | private dialogs |
| `n` | notifications: replies, quotes, mentions, reactions, reputation |
| `l/topics`, `l/posts`, `l/members`, `l/today`, `l/online` | lists (the stat tiles lead here) |
| `search?q=…&in=topics|posts` | search (SQLite FTS5) |
| `mod` | reports (moderators) |
| `me` | the signature's character, avatar |

## 4. API (`/api/forum`, JSON; `Authorization: Bearer <game token>`)

GET `home`, `me`, `section/:slug`, `topic/:id`, `post/:id/where`, `user/:id`, `user/@:name`, `guild/:tag`,
`list/:kind`, `search`, `dialogs`, `dialog/:userId`, `notifications`, `reports`, `file/:name`.
POST `me`, `topic`, `post`, `post/:id/edit`, `post/:id/react`, `post/:id/rep`, `post/:id/report`, `post/:id/mod`,
`topic/:id/mod`, `dialog/:userId`, `notifications/read`, `report/:id/resolve`, `role`, `upload`.

## 5. Tables (`forum.db`)

`forum_users` (account id, name, role, main character, avatar, posts, rep, joined, last seen) · `forum_categories` ·
`forum_sections` (category, slug, RU/EN title and description, icon, admin-only topics) · `forum_topics` (section,
author, title, pinned, official, locked, hidden, views, replies, last post) · `forum_posts` (topic, author, `body_md`,
`reply_to`, `edited_at`, hidden, official) · `forum_reactions` (post, user, emoji) · `forum_reputation` (from, to,
post, ±1) · `forum_messages` (from, to, body, read) · `forum_notifications` · `forum_reports` · `forum_uploads` ·
`forum_fts` (FTS5 over titles and bodies). Seeded on first run: six categories, their sections (RU+EN) and a pinned
official welcome topic from the administration account (`GRAVETIDE`, account 0).

## 6. Security

- **Accounts.** The game's bearer token from `localStorage['gravetide.token']` (same origin) goes in the
  `Authorization` header; the server hashes it and looks the account up (`AuthService.resume`). No cookies, so a
  cross-site page cannot make the browser send the credential (no CSRF): a form post carries no header, and a script on
  another origin cannot set one without a CORS preflight the API never allows.
- **Roles.** `user`, `moderator`, `admin`, `banned`. `FORUM_ADMINS` and `FORUM_MODS` (comma-separated account ids) set
  roles at start; an admin sets roles in a profile. Every check is on the server.
- **Markdown.** The source is escaped first; the renderer emits only its own tags (`p, strong, em, del, code, pre,
  ul, ol, li, blockquote, a, img, video, details, summary, h3, h4, hr, br, span, div, button`) with attributes it
  writes itself. URLs: `http(s)://` or a same-origin path (`/…`, never `//`); images and videos only from the forum's
  uploads and the game's own `/assets/` and `/site/img/`; YouTube only as `https://www.youtube-nocookie.com/embed/<11
  chars>`, loaded on a click. Links to other sites get `rel="nofollow ugc noopener"`.
- **Anti-spam.** Every form carries the honeypot (`website`) and the time since shown (`t`, ≥1.5 s; a new member's
  topic ≥4 s) — `mailguard.formTrapped`. Rate limits per member (posts, topics, messages, reactions, uploads,
  reports) and per address. New members (fewer than 3 posts and a day on the forum) may not post links to other sites.
  Coarse words are masked (`shared/src/chat.ts maskBadWords`).
- **Uploads.** PNG, JPEG and WebP ≤ 3 MB, MP4 ≤ 25 MB, checked by their first bytes; stored under
  `<DB_PATH dir>/forum-uploads/`, served by `/api/forum/file/<name>` with their own type, `nosniff` and a CSP that
  runs nothing.

## 7. Speed

The page is a handful of small modules (no framework); pictures are the site kit's WebP; below the first screen
everything is `loading="lazy"`; the YouTube player loads only on a click; posts are paged (15) and topics (20).
