# Azurdle ☁

**One Azure service. Five clues. A daily cloud challenge.**

[Play Azurdle](https://davidgamero.github.io/azurdle/)

A daily Azure-service guessing game with a compact Azure Portal-inspired interface.
Built with React, TypeScript, and Vite. Runs entirely on static GitHub Pages:
no backend, account, API keys, or runtime requests to Microsoft.

## Play

On your first visit, choose **Let's do it** in the welcome dialog to get started.
The welcome is remembered in this browser.

1. Identify a service from its official icon.
2. Search by name, acronym, or a supported historical name. Typo-tolerant search
   highlights the closest match. Tap a suggestion, press **Enter**, or use
   **Guess** to submit it immediately; arrow keys change the highlighted match.
   Suggestions omit the leading “Azure” and are text-only. On mobile they open
   above the input and size to the space visible above the keyboard.
3. Each wrong guess or **Next clue** consumes one of five attempts and reveals a clue:
   **icon → categories → initials → description preview → full description**.
4. Each hint has its own row, with future hints grayed out. Your numbered guess
   and its service icon appear beneath the hint used. Skips are numbered too.
5. Copy a spoiler-free five-tile result grid, or keep learning in unlimited
   practice mode. 🟥 incorrect · 🟨 close · ⬜ skipped · 🟩 correct · ⬛ unused.

**Close** means the guess shares at least one of Microsoft's published product
categories with the answer. The catalog contains 21 non-exclusive categories,
including Compute, Containers, Networking, Storage, Databases, and Security.
For example, Functions and Container Apps overlap in Compute and Containers.
Close guesses consume an attempt and reveal the next hint; only the exact
service wins. Results and copied grids use the same classification.
Sources: [Azure product categories](https://azure.microsoft.com/en-us/products/),
[Compute](https://azure.microsoft.com/en-us/products/category/compute/), and
[Containers](https://azure.microsoft.com/en-us/products/category/containers/).

Use the command-bar menus: **Game** for daily/practice, **View** for statistics and the
service directory, and **Help** for instructions and credits. Menus support
arrow keys, Enter, and Escape. The main screen keeps only the icon, clues,
search, and large **Guess / Next clue** buttons.
Hint text sits beside its label, with guesses underneath. The icon is also
inline on screens up to 800px tall; taller screens give it a full-width row.
Short screens use tighter spacing to keep the primary controls in reach.

The daily service is the same for everyone and changes at **00:00 UTC**.
Daily progress, stats, and practice progress are saved in browser local storage.
Streaks count consecutive daily wins. A skipped day or a loss breaks the streak;
an unfinished current day does not. Practice does not affect daily statistics.
Five-attempt games use the `azurdle:v2:` storage namespace. Previous six-attempt
saves remain intact under `azurdle:v1:` and are not mixed into the new scores.

## Develop

Requires Node.js 22+.

```sh
npm ci
npm run dev
```

```sh
npm test                          # Game rules, scheduling, catalog, persistence, stats
npm run build                     # TypeScript check and production build
npx playwright install chromium
npm run test:e2e                  # Desktop + mobile browser scenarios
npm run preview
```

Browser tests cover keyboard search, wins/losses, progressive clues, result
sharing, reloading, stats, UTC rollover, unavailable storage, directory filters,
short-screen layouts, and keyboard-accessible portal menus. Service icons are bundled
locally; the interface uses system fonts.

## Catalog and scraper

The initial catalog includes **200 distinct products** from Microsoft's current
[Azure product directory](https://azure.microsoft.com/en-us/products/). Every
published product card with a description and product link is imported;
repeated cards are deduplicated by URL and their categories are merged.
The final clue is the complete summary published in this directory, rather
than an entire product page.

**180 products have matched official icons** from the architecture icon pack or
Microsoft's documentation hub. Products without matched icons are still
searchable, but cannot be puzzle answers. Search results never show icons;
icons appear in the first puzzle clue and beside submitted guesses.
This catalog reflects Microsoft's published directory, including related
developer products. It is not a list of every Azure resource-provider type.

```sh
npm run catalog:refresh           # Download current official sources and regenerate
npm run catalog:refresh -- --cached  # Reuse cached sources when adjusting mappings
```

- `scripts/scrape-catalog.mjs`: repeatable import, source metadata, validation.
- `scripts/icon-mapping.json`: reviewed icon mappings and search aliases.
- `src/data/catalog.json`: committed catalog snapshot; no runtime scraping.
- `src/data/daily-pool.json`: frozen answer IDs, initially generated by the scraper.
- `public/icons/`: self-hosted, unmodified official icons and one original fallback.

The answer pool is shuffled deterministically in cycles; no answer repeats
within a cycle. **Do not regenerate the frozen daily pool after launch:** doing
so changes existing dates' answers. Add new services to practice freely; use
a new versioned schedule with a future activation date for new daily pools.
If a scrape removes or renames a frozen ID, it fails rather than silently
breaking the schedule. Preserve IDs and review renames before committing.
Some services share official icons; the later clues distinguish them.

Scraper output and all source changes are reviewed and committed explicitly.
Deployments build the committed snapshot rather than fetching a moving catalog.

## GitHub Pages

`.github/workflows/deploy.yml` runs tests, builds, runs desktop/mobile browser
tests, and deploys `dist/` on pushes to `main`. Enable **Settings → Pages →
Source → GitHub Actions**. Pull requests run checks without deploying.

Vite uses a relative base (`./`), so assets work at `/azurdle/` and at the root
of a future custom domain. For a domain, set it in GitHub Pages, configure the
required DNS records, and add `public/CNAME` containing the domain. No application
code changes are needed.

## License and credits

Original code/artwork: MIT. Microsoft service icons and product descriptions
retain their original terms.
See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Independent educational fan project; not affiliated with Microsoft.
