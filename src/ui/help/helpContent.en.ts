// Documented help (HelpCenter) body copy — English. `docs/PLAN-HELP-OVERHAUL.md` decisions 1·2·3.
// Source of truth for structure: `helpContent.ko.ts`.
//
// ── What this file is ───────────────────────────────────────────────────────────────
// One screen feature = one topic, written as a guide a coach opening the app for the
// first time can follow along with. No internal implementation, file paths, or decision
// numbers here — that belongs in the plan doc and code comments.
//
// ── Source of truth and contract ──────────────────────────────────────────────────────
// ⚠️ **The topic id set's source of truth is `docs/PLAN-HELP-OVERHAUL.md` §2.1.** This file
//    must carry **the same section keys and the same topic ids, in the same order**, as
//    `helpContent.ko.ts` and `helpContent.ja.ts` (a test checks this). Adding or removing a
//    topic means updating all three files and §2.1 in the same commit.
// ⚠️ **Never hand-write a shortcut table.** Keys only ever ride in as `{ kind: 'keys', scope }`
//    — the rows are derived from `src/core/keymap.ts`. A hand-written table drifts the moment
//    the source of truth changes (2026-08-16 lesson).
//
// ── Label-quoting rule ────────────────────────────────────────────────────────────────
// Button/field names that actually appear on screen are quoted verbatim in [brackets], and
// that string must be the real value from `src/i18n/en.ts` (not a translation of the Korean
// label — looked up in the dictionary). ⚠️ **Never wrap a label in backticks** — backticks are
// for keys only and render as `<kbd>`; a button name drawn as a keycap reads to a beginner as
// something to press on the keyboard. Don't invent a button that doesn't exist — a wrong
// quote means the reader can't find it on screen.
//
// Only two inline forms are recognized: `**bold**` and a backtick-wrapped key (`Ctrl+S` → kbd).
// No other markdown is interpreted, so don't use it.

import type { HelpContent } from './helpContent.ts';

export const HELP_EN: HelpContent = {
  // ── Getting started ──────────────────────────────────────────────────────────────
  start: {
    key: 'start',
    intro: 'New here? Start with this section — it covers how the app is laid out and how to build your first drill.',
    topics: [
      {
        id: 'start.what',
        title: 'What SPIN is',
        blocks: [
          { kind: 'p', text: 'SPIN is an app for powerchair football coaches to **draw training scenes, chain them together, and show them to the team.** Unlike a paper tactics board, a scene can span several frames (steps) that play back as motion.' },
          { kind: 'h', text: 'Five screens' },
          {
            kind: 'list',
            items: [
              '[Board] — the free tactics board. Draw on it right away, with nothing saved.',
              '[Drills] — the list of drills you have made. Open one to edit it, or present it right away.',
              '[Sessions] — a training plan that groups drills into phases.',
              '[Rules] — read the powerchair football rules by topic and see them play out as scenes.',
              '[Settings] — display, accessibility, data, and sync.',
            ],
          },
          { kind: 'p', text: '**Presenting** is not a separate menu item — you get there by tapping the play icon on a drill card or a session.' },
        ],
      },
      {
        id: 'start.first-drill',
        title: '10-minute walkthrough — your first drill',
        blocks: [
          { kind: 'p', text: 'Do this once end to end and everything else follows the same pattern.' },
          {
            kind: 'steps',
            items: [
              'On the [Drills] screen, tap [New Drill], pick a name and a court, then [Create].',
              'Drag player chips from the tray (at the bottom or on the right) onto the court. Pull balls from the ball box and cones from the cone box.',
              'In the step list on the left, tap [+] to add a step — it duplicates the previous one.',
              'In the new step, move the players and ball to their next positions. That change is the whole scene.',
              'Tap play to check the flow.',
              'Tap [To Present] in the header to switch to the screen you show the team.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'Drills save automatically. Don’t go looking for a save button — every change lands on this device the instant you make it.' },
        ],
      },
      {
        id: 'start.navigation',
        title: 'Moving between screens and the app chrome',
        blocks: [
          { kind: 'p', text: 'The rail on the left (top, in a narrow window) holds the five screens. The one you’re on is marked.' },
          {
            kind: 'list',
            items: [
              '**Header** — different on every screen. On the drill list it holds the [Search drills] box and [New Drill]; while editing it shows the drill name and [To Present].',
              '**Theme toggle** — light or dark. Pick whichever matches your gym lighting.',
              '**Language** — [Auto], 한국어, English, 日本語. Auto follows the device’s browser language.',
              '**Version badge** — tap it to open the "What’s new" changelog, and step through older or newer versions.',
              '**Help** — the question-mark icon. It opens the section that matches whatever screen you’re on.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'Even when the window is narrow enough to collapse the rail, language, help, theme, and version stay in the header. Nothing disappears.' },
          { kind: 'tip', tone: 'tip', text: "On a very small screen you get a one-time [This screen may be too small to work on] notice. [Continue] carries on anyway, [Don't show this again on this device] silences it, and [Settings] → [Help & tutorial] brings it back." },
        ],
      },
      {
        id: 'start.saving',
        title: 'The difference between saving, backup, and sync',
        blocks: [
          { kind: 'p', text: 'These are three different things. Mixing them up can cost you data, so it’s worth a read.' },
          {
            kind: 'list',
            items: [
              '**Auto-save** — drills and sessions save to this device the instant you change them. The free tactics board keeps its latest single board on this device, but it **never enters the drill list** — to keep it, use [Edit as drill].',
              '**Backup (file)** — [Export data] in [Settings] bundles drills, sessions, settings, and the tactics board into one file. Open it on another device with [Import data].',
              '**Sync** — turning on [Google Drive Sync] shares drills, sessions, and teams across devices through your own Drive’s app-only space. Settings and the tactics board never go up.',
            ],
          },
          { kind: 'tip', tone: 'warn', text: 'Clearing this browser’s site data wipes this device’s drills along with it. Keep a backup file of anything important.' },
        ],
      },
      {
        id: 'start.help-and-tour',
        title: 'Help and the tour',
        blocks: [
          { kind: 'p', text: 'The screen you’re reading right now is **Help**. Pick a section from the left contents list, or type a word into the search box above to filter topics.' },
          { kind: 'p', text: 'The **tour** is the speech-bubble walkthrough that appears the first time you open a screen. Once you’ve seen it, it won’t appear again on its own.' },
          {
            kind: 'steps',
            items: [
              'To watch one screen’s tour again, use the replay-tour button at the end of that screen’s section in Help.',
              'To watch every tour again from scratch, go to [Settings] → [Help & tutorial] → [Replay all].',
              'To stop a tour early, tap [Skip] on the speech bubble, or tap outside it.',
            ],
          },
        ],
      },
    ],
  },

  // ── Free tactics board ──────────────────────────────────────────────────────────────
  board: {
    key: 'board',
    intro: 'A scratch pad with no saving. Use it to explain something on the fly or work out an idea for a moment.',
    topics: [
      {
        id: 'board.what',
        title: 'How the board differs from a drill',
        blocks: [
          { kind: 'p', text: 'The free tactics board is a single court. Unlike a drill, it has **no steps**, and nothing to play back.' },
          {
            kind: 'list',
            items: [
              '**It is never saved as a drill.** The latest board stays on this device and comes back next time, but it does not appear in the drill list — to keep it, tap [Edit as drill].',
              'The step list, playback controls, and step-related shortcuts don’t appear.',
              'The tools, tray, drawing, and object menu all work exactly as they do in the drill editor.',
            ],
          },
          { kind: 'tip', tone: 'warn', text: 'The board stays on this device even after you close the app, but it isn’t a saved drill — it won’t show up in the list, and you can’t present it.' },
        ],
      },
      {
        id: 'board.court',
        title: 'Changing court shape, size, and side',
        blocks: [
          { kind: 'p', text: '[Board settings] is where you change [Court Shape] (full/half/flat), [Court Size] (three steps), and which side you defend. The three sizes only apply to the full court. The [Court Shape] switch in the header changes it straight away too.' },
          {
            kind: 'steps',
            items: [
              'Open [Board settings].',
              'If anything is on the court, [Clear Court] first.',
              'Pick a shape and size. Clearing comes first because the dimensions differ and a layout can’t carry across them.',
              'Use [Swap Sides] to set which goal your team defends.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'Which side you defend decides **which team the goal-area 3-player foul applies to.** The flat court has no goal area, so there’s no side to defend either.' },
        ],
      },
      {
        id: 'board.to-drill',
        title: 'Keeping it as a drill',
        blocks: [
          { kind: 'p', text: 'Tapping [Edit as drill] asks for a name, saves the current layout as a one-step drill, and takes you to that drill’s editor.' },
          { kind: 'tip', tone: 'tip', text: 'The tactics board is left untouched — this makes a copy rather than moving it. Feel free to keep drawing on it afterward.' },
        ],
      },
    ],
  },

  // ── Drill library ────────────────────────────────────────────────────────────────
  library: {
    key: 'library',
    intro: 'The screen for finding, making, and sharing the drills you’ve built.',
    topics: [
      {
        id: 'library.list',
        title: 'Viewing, filtering, and sorting the list',
        blocks: [
          { kind: 'p', text: 'Once you have a lot of drills, filter to find the one you want. Conditions stack together.' },
          {
            kind: 'list',
            items: [
              '**Type filter** — [All] or a specific drill type.',
              '**Situation filter** — [All situations] or a specific one.',
              '**Sort** — [Recently updated], [Date created], or [Name].',
              '**View mode** — [Cards] shows bigger thumbnails; [List] fits more on screen.',
              '**Header search** — typing part of a name into [Search drills] filters instantly.',
            ],
          },
          { kind: 'p', text: 'The list is grouped by difficulty level, and it tells you plainly when no drill matches your filters.' },
        ],
      },
      {
        id: 'library.new-drill',
        title: 'Creating a new drill',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Tap [New Drill] in the header. If the list is empty, the [Create a drill] button in the middle does the same thing.',
              'Type a [Drill name]. Leave it blank and a default name is used.',
              'Pick a [Court Shape] and [Court Size].',
              '[Create] — a one-step drill is made and its editor opens right away.',
            ],
          },
          { kind: 'tip', tone: 'warn', text: '**Court shape and size can’t be changed after this.** The saved layout would have nowhere to go — choose carefully here.' },
        ],
      },
      {
        id: 'library.card',
        title: 'What you can do from a drill card',
        blocks: [
          {
            kind: 'list',
            items: [
              '**The card body (title, thumbnail)** — tap to open its editor.',
              '**The play icon** — jumps straight to presenting it, skipping the editor.',
              '**The ⋮ menu** — [Duplicate], [Export to file], [Share as link], [Delete].',
              '**Badges** — duration (minutes) and step count are printed right on the card.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: '[Duplicate] never touches the original. Duplicate first and edit the copy when you want to try a variation.' },
        ],
      },
      {
        id: 'library.delete-undo',
        title: 'Deleting and undoing it',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Card ⋮ → [Delete].',
              'A confirmation appears. If any session uses that drill, it tells you **how many sessions it will drop out of.**',
              'Tap [Delete] and it’s gone — a toast appears below.',
              'Deleted the wrong one? Tap [Undo] on the toast.',
            ],
          },
          { kind: 'tip', tone: 'warn', text: '**There is no trash.** Your only chance to undo is while the toast is on screen — once it’s gone, only a backup file can bring it back.' },
        ],
      },
      {
        id: 'library.import',
        title: 'Importing from a file',
        blocks: [
          { kind: 'p', text: '[Import] reads a drill file or a drill-collection file. If a matching drill already exists, it asks how to handle each one.' },
          {
            kind: 'list',
            items: [
              '[Add as copy] — keeps both. The safest choice.',
              '[Overwrite] — replaces the one on this device with the one from the file.',
              '[Skip] — leaves just that item out of the import.',
            ],
          },
          { kind: 'p', text: 'When it’s done, you get a one-line report of **how many imported, and how many failed or were skipped.**' },
          { kind: 'tip', tone: 'warn', text: 'A full device-transfer backup file opens from [Settings] → [Import data], not here. Drop it in the wrong place and the app tells you where it belongs.' },
        ],
      },
      {
        id: 'library.share-link',
        title: 'Sharing as a link',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Card ⋮ → [Share as link]. Wait a moment while the link is created.',
              'Tap [Copy] and paste the address into a chat.',
              'If copying is blocked in your browser, select the address in the box and copy it yourself.',
            ],
          },
          { kind: 'p', text: 'Only someone with the link can open it, **the server keeps ciphertext only, and it expires after 180 days.** The decryption key travels inside the link address itself.' },
          { kind: 'h', text: 'When it won’t open' },
          {
            kind: 'list',
            items: [
              'The link is gone or expired — ask the sender for a new one.',
              'The key doesn’t match — the link may have been cut, so ask for the **whole** thing again.',
              'The app is too old — reload it and try the link again.',
              'Can’t reach the server, or too many requests — try again in a moment.',
              'The drill is too large — use [Export to file] instead.',
            ],
          },
        ],
      },
      {
        id: 'library.share-receive',
        title: 'Opening a shared drill or session',
        blocks: [
          { kind: 'p', text: 'Opening a received link shows a [Shared drill] window where you can preview it before saving. Nothing lands on this device until you tap [Save to my library].' },
          { kind: 'p', text: 'A session link opens as [Shared session]. There’s no board to show for a whole session, so it previews as a **list of drill titles** instead. Saving brings in the session and every drill inside it together.' },
          { kind: 'p', text: 'If you can’t tap the link to open it, use [Import from link] on the [Drills] or [Sessions] list and paste the address — the same window opens.' },
          { kind: 'tip', tone: 'tip', text: 'A session link carries its location and notes, but **the participant roster is never included** — names never travel through a link.' },
        ],
      },
    ],
  },

  // ── Drill editor ────────────────────────────────────────────────────────────────
  editor: {
    key: 'editor',
    intro: 'The screen you’ll spend the most time in. Place things, move them, and chain steps together.',
    topics: [
      {
        id: 'editor.layout',
        title: 'Screen layout',
        blocks: [
          {
            kind: 'list',
            items: [
              '**Header** — the drill name (tap to edit right there), [Add description], the [Court Shape] switch (locked in a drill — tapping it tells you why), [To Present].',
              '**Tray (tool rail at the bottom or on the right)** — tools, the player/ball/cone boxes, and the drawing and notes drawers.',
              '**Court** — the space where you actually place and drag things.',
              '**Function bar (right)** — zoom, undo, [Board settings], [Info], [Export], [Speed].',
              '**Step list** — step cards with a link button between each pair, plus the playback controls.',
              '**Note strip** — the [Notes] box below the court, for what the coach will say during this step.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'In a narrow window the step list collapses — tap its handle to open and close it.' },
        ],
      },
      {
        id: 'editor.tools',
        title: 'The eleven tools',
        blocks: [
          { kind: 'p', text: 'The top of the tray holds the tools. Pick one, then tap the court to place it.' },
          {
            kind: 'list',
            items: [
              '[Select] — grabs and moves whatever is already on the court. The default tool.',
              '[Line] — draws an arrow (a movement path).',
              '[Freehand] — free drawing. Leaves a stroke wherever you drag.',
              '[Circle], [Triangle], [Square] — shapes for marking zones.',
              '[Ball], [Cone], [Player] — objects you drop onto the court.',
              '[Note] — a sticky note on the court.',
              '[Erase] — wipes out whatever you tap, one after another.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'Placing one item switches you back to [Select] automatically. **Tap the same tool a second time and it locks**, so you can place several in a row. A pin badge lights up on the tool while it’s locked, and tapping again releases it.' },
          { kind: 'keys', scope: 'tools' },
        ],
      },
      {
        id: 'editor.tray',
        title: 'The tray — player chips, ball box, cone box, drawers',
        blocks: [
          {
            kind: 'list',
            items: [
              '**Player chips** — laid out by team. Drag one onto the court, or tap it then tap the court. A chip already on the court is marked as such, and dragging it back from the court returns it.',
              '**Ball box** — shows how many are left. Use them all up and the box goes empty.',
              '**Cone box** — orange and blue are separate boxes, each counting its own color.',
              '**Drawers** — [Draw] folds away arrows, shapes, and freehand drawing; [Notes] folds away sticky notes.',
            ],
          },
          { kind: 'tip', tone: 'warn', text: 'Tapping the court without picking a player chip first places nothing — it tells you to choose who to place from the tray first.' },
        ],
      },
      {
        id: 'editor.place-move',
        title: 'Placing and moving',
        blocks: [
          { kind: 'p', text: 'For a wheelchair, **where you grab it is the action** — unlike sliding a piece on paper, it moves the way a real powerchair does.' },
          {
            kind: 'list',
            items: [
              'Grab the **back two-thirds** of the chair and it moves as a whole.',
              'Grab the **front third** of the chair and it spins in place.',
              'Grab the **handles outside the chair, front or back,** and it tows like it’s being pulled by a rope — it turns first.',
            ],
          },
          { kind: 'p', text: 'For the last few pixels, use the keyboard. On a tablet with no keyboard, long-press the object and choose [Fine-tune] — a translucent pad appears in place with six cells: four to nudge up, down, left and right, and two to rotate left and right.' },
          { kind: 'tip', tone: 'tip', text: 'Turn on [Speed] in the function bar and objects only move at real powerchair speed (10 km/h); turn it off and they follow the pointer instantly.' },
        ],
      },
      {
        id: 'editor.select',
        title: 'Selecting and multi-select',
        blocks: [
          {
            kind: 'list',
            items: [
              'The [Select] tool grabs the nearest object even if your tap is slightly off.',
              'Tap a selected object again in place, or press `Esc`, to deselect it.',
              'Drag over empty court to rubber-band select everything inside the rectangle.',
              'Hold `Shift` or `Ctrl` while tapping to add objects one by one.',
              'Lock the [Select] tool with a second tap and a plain tap alone adds to or removes from the selection.',
              '`Ctrl+A` selects everything except locked objects.',
            ],
          },
          { kind: 'p', text: 'With several selected, drag any one of them and **all of them move together.** Tap without dragging and only that one stays selected.' },
        ],
      },
      {
        id: 'editor.object-menu',
        title: 'The object menu — what a long press brings up',
        blocks: [
          { kind: 'p', text: 'Long-press an object (right-click with a mouse) to bring up its menu.' },
          {
            kind: 'list',
            items: [
              '[Edit] — only appears on objects with content to edit, like a note.',
              '[Duplicate] — makes one more right where it is. Selecting several shows the count.',
              '[Lock] — blocks **movement only.** It stays in place, physics interaction is unchanged, and a locked object shows a red outline.',
              '[Ignore] — wheelchairs only. It’s drawn faded and dropped entirely from physics, so **the ball passes through it and it no longer collides with other wheelchairs.** You can still select and move it.',
              '[Display order] — swaps the front-to-back order of overlapping objects.',
              '[Fine-tune] — opens the fine-tune pad.',
              '[Delete] — removes it.',
              '**Select all of the same kind** — selects every object of the same team, ball, cone, note, arrow, shape, or freehand stroke at once.',
            ],
          },
          { kind: 'h', text: 'The Display order submenu' },
          { kind: 'p', text: 'Opening [Display order] shows four items: [Bring to front], [Bring forward], [Send backward], [Send to back]. [Back] returns you to the previous menu. If nothing overlaps, all four are disabled and it says [Nothing overlaps this object] — reordering wouldn’t change anything on screen. Display order is tracked **separately for each step.**' },
          { kind: 'tip', tone: 'tip', text: '**Removing and deleting are different.** Players, balls, and cones return to the tray (removing); arrows, notes, shapes, and strokes have nowhere to return to, so they’re deleted. Dragging something onto the tray tells you which it will be before you let go.' },
        ],
      },
      {
        id: 'editor.arrows-shapes',
        title: 'Arrows, shapes, freehand drawing, and the eraser',
        blocks: [
          { kind: 'p', text: 'Select an arrow and three handles appear — the two ends and a bend point in the middle. **Dragging moves it; releasing without dragging cycles its value.**' },
          {
            kind: 'list',
            items: [
              '**Tap an end handle** — its arrowhead cycles none → thin → wide.',
              '**Tap the bend handle** — the line’s color cycles. Dragging it bends the line.',
              '**The rotation anchor** — drag only. There’s no cycled value from a tap.',
            ],
          },
          { kind: 'p', text: 'Shapes ([Circle], [Triangle], [Square]) size themselves as you drag; [Freehand] draws wherever your hand goes.' },
          { kind: 'tip', tone: 'tip', text: 'Once picked, [Erase] wipes out whatever you tap, one after another. Tap empty space, tap the tool again, or press `Esc` to return to [Select].' },
        ],
      },
      {
        id: 'editor.ball-ring',
        title: 'The ball’s distance ring and set-piece possession',
        blocks: [
          { kind: 'p', text: 'To see a rule distance visually, attach a distance ring to the ball. **Tap a selected ball again in place** to cycle the ring one step at a time.' },
          {
            kind: 'steps',
            items: [
              'None → **3 m** (the 2-on-1 rule distance)',
              '3 m → **5 m — our ball** (the set-piece distance)',
              '5 m (our ball) → **5 m — their ball**',
              '5 m (their ball) → back to none, deselecting it too.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'Turning on 5 m always requires deciding whose ball it is, so possession rides along in the same cycle. The ring is attached **per step.**' },
        ],
      },
      {
        id: 'editor.notes',
        title: 'Two kinds of notes — court sticky notes and step notes',
        blocks: [
          { kind: 'h', text: 'Sticky notes on the court' },
          {
            kind: 'steps',
            items: [
              'Tap the court with the [Note] tool to place a note and open its text field right away.',
              '[Text size] is [Small], [Medium], or [Large]; [Color] is white, sky blue, yellow, or red.',
              'New line with `Enter`, save with `Ctrl+Enter`.',
              'To edit it later, double-tap the note, or long-press it and choose [Edit].',
            ],
          },
          { kind: 'h', text: 'Step notes' },
          { kind: 'p', text: 'The [Notes] box below the court is **what the coach will say during this step.** The presentation screen shows this text as-is. It’s not drawn on the court, and it’s plain text with no formatting.' },
        ],
      },
      {
        id: 'editor.steps',
        title: 'Working with steps',
        blocks: [
          {
            kind: 'list',
            items: [
              'The [+] between cards and at the end of the list — inserts a step right there. It **duplicates the step above**, so you only need to change a little.',
              'The duplicate button below a card — duplicates this step directly beneath it.',
              'Long-press a step card for the [Select], [Duplicate Below], [Duplicate Above], [Delete] menu.',
              'Turn on [Select Mode] to pick several cards and [Duplicate] or [Delete] them at once.',
            ],
          },
          { kind: 'p', text: 'You can reorder with the keyboard too: press `Space` to pick a step up, move it with the up/down arrow keys, then press `Space` or `Enter` to drop it. `Esc` returns it to its original spot.' },
          { kind: 'tip', tone: 'warn', text: '**At least one step must remain**, so you can’t delete them all. At the other end, a drill holds up to **60 steps** — once it’s full, [+] locks. Deleted one by mistake? `Ctrl+Z` brings it back.' },
        ],
      },
      {
        id: 'editor.step-links',
        title: 'The three ways steps can connect',
        blocks: [
          { kind: 'p', text: 'The **button between two step cards** cycles that boundary’s link type, and it looks different during playback and presentation.' },
          {
            kind: 'list',
            items: [
              '[Linked with pause] — the default. The step pauses briefly, then eases into the next position.',
              '[Linked, no pause] — moves straight into the next step’s motion with no pause. Chain several this way and it plays as one continuous animation.',
              '[Cut] — jumps instantly at that boundary. Use it when the scene changes.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'The resting pose of each step is identical in all three cases — the only thing that changes is **how you cross the gap between them.**' },
        ],
      },
      {
        id: 'editor.playback',
        title: 'Playing it back while editing',
        blocks: [
          { kind: 'p', text: 'The playback controls below the step list are the same ones used on the presentation screen: play/pause, previous step, next step, loop, and speed.' },
          {
            kind: 'list',
            items: [
              '`Space` toggles play and pause.',
              'Each tap of the speed button steps up to the next multiplier.',
              'With loop on, the last step jumps back to the first.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'The default step transition speed is set in [Settings] → [Playback]. If playback feels too fast or too slow, look there.' },
        ],
      },
      {
        id: 'editor.view',
        title: 'View — zoom, pan, grid, goal-area guide',
        blocks: [
          {
            kind: 'list',
            items: [
              '[In], [Out], [100%] — or just scroll the mouse wheel over the court (zooms anchored at the cursor).',
              '**Pan** — once zoomed in, push the board around with `Ctrl+arrow keys`, or drag an empty part of the court. [100%] brings it back.',
              '[Grid] — overlays a 1 m grid on the court.',
              '[Goal Area] — shows the goal-area 3-player foul zone as a translucent overlay.',
            ],
          },
          { kind: 'tip', tone: 'warn', text: 'The [Goal Area] switch is not just a display option — **rule-violation alerts are tied to it too.** Turn it off and the 2-on-1 (3 m), set-piece 5 m, goal-area 3-player, and out-of-play warnings stop appearing. A distance ring left on the ball still shows as a white dashed line.' },
        ],
      },
      {
        id: 'editor.board-settings',
        title: 'Board settings',
        blocks: [
          { kind: 'p', text: '[Board settings] in the function bar gathers everything that applies to the whole board.' },
          {
            kind: 'list',
            items: [
              '[Display] — [Grid], [Goal Area].',
              '[Object movement] — [Limit to real speed].',
              '[Goals] — [Reset Goal Position]. Moves only the goals pushed out of place by wheelchairs back to their spot, and touches nothing else on the board.',
              '[Court Shape], [Court Size], and which side you defend.',
              '[Clear Court] — removes every player, ball, cone, arrow, and note in the current step.',
            ],
          },
          { kind: 'tip', tone: 'warn', text: 'In a drill, **court shape and size are locked** (only the free tactics board can change them, and only after clearing it). If a wheelchair sits on a goal’s spot, [Reset Goal Position] is refused — move the chair first. Clearing only empties this step; other steps are untouched, and one undo brings everything back.' },
        ],
      },
      {
        id: 'editor.undo-save',
        title: 'Undo and saving',
        blocks: [
          { kind: 'p', text: '`Ctrl+Z` undoes, `Ctrl+Shift+Z` redoes. The function bar has the same buttons.' },
          { kind: 'p', text: 'A drill **saves automatically.** `Ctrl+S` is just a shortcut that pushes the current state right away — you lose nothing by never pressing it.' },
          { kind: 'tip', tone: 'warn', text: 'Undo history only survives while you stay on this editor screen. Leave and come back, and you can’t undo past that point.' },
        ],
      },
      {
        id: 'editor.drill-info',
        title: 'The drill info sheet',
        blocks: [
          { kind: 'p', text: 'Open [Info] (the pencil icon) at the top of the function bar to write up details about this drill. The print sheet and the presentation info panel both read these values.' },
          {
            kind: 'list',
            items: [
              '[Type], [Situation], [Level] — the drill list filters and groups by these values.',
              '[Duration (min)] — used as the default when scheduling a session.',
              '[Tags] — comma-separated.',
              '[Home team name] and [Away team name].',
              '[Objective] — what this drill achieves.',
              '[How to run it] and [Variation].',
              '[Coaching Points] — one per line.',
              '[Players Needed] (0 means unspecified) and [Equipment].',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'Name and description can be changed without opening the sheet — tap the drill name in the header, or tap [Add description]. The matching field on the presentation screen (the eye icon) is read-only.' },
        ],
      },
      {
        id: 'editor.caps',
        title: 'Count limits',
        blocks: [
          { kind: 'p', text: 'Hit a limit and nothing more gets placed — you’re told why. It’s a designed boundary, not an error.' },
          {
            kind: 'list',
            items: [
              'Steps — 60 per drill',
              'Players — 4 per team',
              'Balls — 8',
              'Cones — 8 per color (orange and blue counted separately)',
              'Arrows, shapes, freehand strokes — 40 each per step',
              'Notes — 20 per step',
              '12 tags, 6 lines of coaching points',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'Hitting a limit is usually a sign you’re packing too much into one drill. Splitting a step, or splitting the drill in two, tends to read better for the team as well.' },
        ],
      },
      {
        id: 'editor.keyboard-court',
        title: 'Working the court with the keyboard alone',
        blocks: [
          { kind: 'p', text: 'Everything works without a mouse. A keyboard cursor appears on screen once the court has focus.' },
          {
            kind: 'steps',
            items: [
              '`Tab` moves focus to the court.',
              'The arrow keys move the grid cursor, `Enter` places the object there.',
              '`[` / `]` step through the objects already placed, one at a time; `Shift+[` / `Shift+]` add each one you pass to the selection as you go.',
              'With an object selected, `W` `A` `S` `D` move it and `Q` `E` rotate it. Add `Shift` for a bigger step.',
            ],
          },
          { kind: 'keys', scope: 'object' },
        ],
      },
    ],
  },

  // ── Sessions ─────────────────────────────────────────────────────────────────────────
  sessions: {
    key: 'sessions',
    intro: 'Group drills in order to plan a day of training.',
    topics: [
      {
        id: 'sessions.what',
        title: 'What a session is',
        blocks: [
          { kind: 'p', text: 'A session is a set of **phases** (units like warm-up and main work) plus the **list of drills** scheduled inside them. Presenting a session all the way through chains the drills together in order.' },
          { kind: 'tip', tone: 'tip', text: 'Drills are reused — adding one to a session doesn’t make a copy, it points at the original. Edit the drill and every session that uses it picks up the change.' },
        ],
      },
      {
        id: 'sessions.list',
        title: 'The session list',
        blocks: [
          { kind: 'p', text: 'At the top of the [Sessions] screen sits a [Next session] card — date/time, location, drill count, and a preview of the schedule all show up together.' },
          {
            kind: 'list',
            items: [
              'Tap the card to open its schedule.',
              '**⋮ menu** — present, [Export], [Share link], [Delete].',
              '[Delete] asks for confirmation once, and the toast that follows offers [Undo] to bring the session back.',
              '[New Session] creates a new one.',
              '[Import from link] above the list takes a session link you received — paste it in.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'Unlike a drill card, a session card **has no Duplicate.** Need something similar? Make a new one and schedule the drills again.' },
        ],
      },
      {
        id: 'sessions.info',
        title: 'Filling in session info',
        blocks: [
          {
            kind: 'list',
            items: [
              '[Name] — the title shown in the list and on the printout.',
              '[Date & time] — shows as [Unscheduled] if left blank.',
              '[Location]',
              '[Goal total time (min)] — the baseline for the allocation gauge.',
              '[Session note] — also appears on the printout.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'It saves the moment you type — there being no confirm button is expected.' },
        ],
      },
      {
        id: 'sessions.phases',
        title: 'Dividing it into phases',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Tap [Add Phase].',
              'Pick a [Kind], and write a [Phase name (optional)] if you want one.',
              'Enter how much time this phase gets in [Planned allocation (min)].',
              'Reorder phases with the up/down arrows.',
            ],
          },
          { kind: 'p', text: 'Each phase shows a subtotal, and it’s marked as over if it exceeds the target.' },
          { kind: 'tip', tone: 'warn', text: 'Deleting a phase doesn’t delete the drills inside it — they **merge into the neighboring phase.** Remove the items first if you want them gone too.' },
        ],
      },
      {
        id: 'sessions.items',
        title: 'Scheduling drills',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Pick a drill from [Choose a drill…] below a phase and it’s added there.',
              'Change the minutes field to override the duration for just this session.',
              'Reorder with the up/down arrows, or remove with the remove button.',
              'Each item can carry a [Note] and a [Rest (min)] as well.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'Removed one by mistake? Tap [Undo] on the toast. An item whose original drill was deleted shows a [Deleted drill] badge and drops out of the time total.' },
        ],
      },
      {
        id: 'sessions.allocation',
        title: 'The time allocation gauge',
        blocks: [
          { kind: 'p', text: '[Planned total] shows the minutes scheduled so far alongside the [Goal total time (min)].' },
          {
            kind: 'list',
            items: [
              'It’s marked over once you pass the goal.',
              'If a drill’s original is gone, it also notes how many were excluded from the total.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'Going over **isn’t blocked.** The gauge is a guide for your judgment, not a limit.' },
        ],
      },
      {
        id: 'sessions.participants',
        title: 'Checking off participants',
        blocks: [
          { kind: 'p', text: 'Check off which players are coming in the [Participants] section. The number checked, and how many of those are PF2, both show up here and on the printout.' },
          { kind: 'tip', tone: 'warn', text: 'Nothing to check if the roster is empty — make a team on the [Teams] screen and register names and PF classes in its [Players] section first.' },
        ],
      },
      {
        id: 'sessions.present-export',
        title: 'Presenting, exporting, and sharing a session',
        blocks: [
          {
            kind: 'list',
            items: [
              '[Start presenting session] — plays through the drills in scheduled order.',
              '[Export] — gets the session as a single file.',
              '[Share link] — lives on the session card’s ⋮ menu. The session and every drill in it travel together.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'A session share link carries its location and notes, but not the participant roster.' },
        ],
      },
    ],
  },

  // ── Teams ─────────────────────────────────────────────────────────────────────────
  team: {
    key: 'team',
    intro: 'Keep several teams, each with its own roster, staff, and lineup.',
    topics: [
      {
        id: 'team.new',
        title: 'Creating a team',
        blocks: [
          { kind: 'p', text: 'The [Teams] screen lays out the teams you have made as cards. A card shows the team colour swatch, name, short name, player count, PF chips, and staff count.' },
          {
            kind: 'steps',
            items: [
              'Press [New team].',
              'Type the team name (up to 40 characters).',
              'Type a short name (up to 6 characters) — narrow screens and printouts use it instead of the full name.',
              'Pick a [Team colour] and a [Goalkeeper colour].',
              'Fill in [League], [Season], and [Note] only if you need them.',
            ],
          },
          { kind: 'p', text: 'Everything saves as you type — there is no confirm button, and that is normal. You can keep up to 20 teams.' },
          { kind: 'tip', tone: 'tip', text: 'The Laws require the goalkeeper to wear a colour that **stands apart from both teams and the officials.** That is why the team colour and the goalkeeper colour are two separate settings.' },
          { kind: 'tip', tone: 'tip', text: 'For age groups or a new season, use [Duplicate] in the card ⋮ menu and change [Season]. Players in the copy are **registered as new people**, so participation already recorded in past sessions stays with the original team.' },
        ],
      },
      {
        id: 'team.players',
        title: 'The roster',
        blocks: [
          { kind: 'p', text: 'Open a team and the [Players] section holds the roster. A team takes up to 30 players.' },
          {
            kind: 'steps',
            items: [
              'Type a name in the add row at the bottom and press Enter — the player is in.',
              'Press a row to expand it and fill in the rest.',
              'Once the list is long, use the search box and the sort (number, name, class) at the top.',
            ],
          },
          {
            kind: 'list',
            items: [
              '[Number] — 0 to 99.',
              '[PF class] — PF1, PF2, or unclassified.',
              '[Captain] — only one per team.',
              '[Prefers goalkeeper] — the lineup offers this player first when you pick a keeper. The keeper on the day can change, so this is **a preference, not a fixed role**.',
              '[Chair model], [Birth year], [Note] — only if you need them.',
              '[Active] — turn it off and the player is hidden from the roster. That is how you tidy up a player who has left **without deleting them**.',
            ],
          },
          { kind: 'p', text: 'Each row also shows how many sessions that player attended — it is counted from the [Participants] checks on your sessions, so there is nothing to keep up to date.' },
          { kind: 'tip', tone: 'warn', text: 'Do **not** put medical details, diagnoses, phone numbers, or carer contacts in [Note]. This app deliberately has no field for any of that — not holding it is the strongest protection there is.' },
          { kind: 'tip', tone: 'tip', text: 'Delete a player and you have 8 seconds to press [Undo] in the toast. In sessions already recorded, the player stays as [Deleted player].' },
        ],
      },
      {
        id: 'team.staff',
        title: 'Staff',
        blocks: [
          { kind: 'p', text: 'The [Staff] section is for the people around the team — coaches, managers, and so on. Up to 15 per team.' },
          {
            kind: 'steps',
            items: [
              'Type a name in [Add staff].',
              'Pick the roles — coach, assistant coach, manager, doctor, carer, mechanic. **One person can hold several.**',
              'Turn on [Senior coach] for the one person who answers for the team (one per team).',
              'If a staff member also plays, pick their name from the roster in [Also a player].',
            ],
          },
          { kind: 'p', text: 'The Laws make the senior coach responsible for the team bench — a bench sanction that cannot be pinned on anyone in particular goes to that person.' },
          { kind: 'tip', tone: 'tip', text: 'There are no licence-number or expiry fields. Tournament paperwork is handled outside this app.' },
        ],
      },
      {
        id: 'team.lineup',
        title: 'Lineup and the PF2 rule',
        blocks: [
          { kind: 'p', text: 'The [Lineup] section is where you set out the four court places (one of them the goalkeeper) and the bench. One lineup is saved per team.' },
          {
            kind: 'steps',
            items: [
              'Press an active player to put them on court.',
              'Mark one of the players on court as the goalkeeper.',
              'Leave the rest on the bench.',
            ],
          },
          { kind: 'h', text: 'Two PF2 players per match, no more' },
          { kind: 'p', text: 'In FIPFA-sanctioned competition a team **may not field more than two PF2 players in a match.** By contrast there is **no limit on the class mix inside the squad** — a roster of 30 PF2 players breaks no rule.' },
          { kind: 'p', text: 'If it happens, the referee stops play as soon as it is noticed, sends the extra player off, gives **a yellow card to the player and to the coach**, and restarts with an **indirect free kick** to the opponents where the ball was. A team that cannot fix it plays a player short.' },
          {
            kind: 'list',
            items: [
              '**Three or more PF2 in the lineup** — court and bench are counted **together**, because a third PF2 coming on as a substitute breaks the rule just the same.',
              '**Fewer than two players on court** — the lineup is not filled in yet.',
              '**No goalkeeper** — mark one of the players on court.',
            ],
          },
          { kind: 'tip', tone: 'warn', text: 'The warnings **tell you, they do not block you.** You have to be able to write down what actually happened at training.' },
          { kind: 'tip', tone: 'tip', text: 'Unclassified players count as neither PF1 nor PF2. Set the class in the [Players] section once it is known.' },
        ],
      },
      {
        id: 'team.export',
        title: 'Export, sync, and printing',
        blocks: [
          {
            kind: 'list',
            items: [
              '[Export] in the card ⋮ menu — saves one team as a file.',
              '[Import] above the list — opens a team file you received.',
              '[Settings] → [Sync] turns on Google Drive, and teams travel between your devices too.',
              '[Print] in the card ⋮ menu — prints a team sheet (names, numbers, captain, keeper preference, staff roles, and the court/bench if a lineup exists).',
              'The backup file in [Settings] carries every team with it.',
            ],
          },
          { kind: 'p', text: 'Both export and print offer **[Exclude class information]**. Turn it on and the file — or the printout — comes out without PF classes.' },
          { kind: 'tip', tone: 'warn', text: 'A sport class comes out of a medical classification assessment. Before you hand a file to anyone outside the team, or pin a printout to a wall, think about [Exclude class information] first.' },
          { kind: 'tip', tone: 'tip', text: 'Edit the same team on two devices and the later edit wins. Delete it on one device and it goes from the synced devices too.' },
        ],
      },
      {
        id: 'team.noShare',
        title: 'Why there is no share link',
        blocks: [
          { kind: 'p', text: 'Drill and session cards have [Share as a link]. Team cards do not. That is **deliberate, not an omission.**' },
          { kind: 'p', text: 'A team document holds real names, numbers, and classes — **information about people other than you.** Once a link exists you cannot trace who received it or where they passed it on.' },
          {
            kind: 'list',
            items: [
              'Teams travel two ways only: **as a file** and **through Google Drive sync** — with both, the person handing it over knows who is receiving it.',
              'Share a session as a link and **neither the team it belongs to nor the participants** go with it.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'To hand a team to another coach, [Export] it and pass the file over yourself.' },
        ],
      },
    ],
  },

  // ── Presentation ─────────────────────────────────────────────────────────────────────────
  present: {
    key: 'present',
    intro: 'The screen you show your team. Every editing feature is left out.',
    topics: [
      {
        id: 'present.start-exit',
        title: 'Entering and leaving',
        blocks: [
          {
            kind: 'list',
            items: [
              'The play icon on a drill card — presents that one drill.',
              '[To Present] in the editor’s header.',
              '[Start presenting session] in session editing — presents the whole schedule in sequence.',
            ],
          },
          { kind: 'p', text: 'To leave, tap [To Editor] or [To Session] in the header (whichever matches where you came from), or press `Esc`.' },
        ],
      },
      {
        id: 'present.controls',
        title: 'Playback controls',
        blocks: [
          {
            kind: 'list',
            items: [
              'Play/Pause — `Space`.',
              'Previous / next step — the arrow keys, or `PageUp`/`PageDown`.',
              'Loop — jumps from the last step back to the first.',
              'Speed — each tap steps up to the next multiplier.',
              'The step progress bar — tap any point to jump straight to that step.',
            ],
          },
          { kind: 'keys', scope: 'present' },
        ],
      },
      {
        id: 'present.fullscreen',
        title: 'Fullscreen',
        blocks: [
          { kind: 'p', text: 'Tap [Fullscreen] to fill the screen. Tap it again, or press `Esc`, to leave.' },
          { kind: 'tip', tone: 'tip', text: 'Turn on [Settings] → [Presentation] → [Auto fullscreen] and it tries to enter fullscreen the moment you open the presentation screen. If **that screen’s first-visit tour hasn’t finished yet**, though, auto-fullscreen holds off so it doesn’t cover the tour.' },
        ],
      },
      {
        id: 'present.gestures',
        title: 'Touch gestures',
        blocks: [
          {
            kind: 'list',
            items: [
              'Swipe left/right — previous / next step.',
              'Tap — while the screen is blacked out, a tap anywhere brings it back. Tapping a cell of the step progress bar jumps straight to that step.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'Turn the tablet to face the team and advance with swipes alone, without needing to look at the screen yourself.' },
        ],
      },
      {
        id: 'present.blackout',
        title: 'Blacking out the screen',
        blocks: [
          { kind: 'p', text: 'Press `Alt+B` and the screen goes black. Use it to pull the players’ eyes away from the screen while you explain something.' },
          { kind: 'p', text: 'Tap the screen, or press `Enter` or `Space`, to bring it back. Playback position doesn’t change.' },
        ],
      },
      {
        id: 'present.info-roster',
        title: 'The info panel and roster',
        blocks: [
          { kind: 'p', text: '[Info] (the eye icon) shows a drill’s type, situation, level, duration, objective, how to run it, and coaching points.' },
          { kind: 'p', text: 'During a session presentation, [Roster] shows the players attending today.' },
          { kind: 'tip', tone: 'warn', text: 'During a presentation everything here is **read-only.** To edit it, go to the matching field (the pencil icon) in the editor.' },
        ],
      },
      {
        id: 'present.session-flow',
        title: 'How a session presentation flows',
        blocks: [
          { kind: 'p', text: 'Presenting a session chains the drills together in schedule order. Overall session progress and which drill you’re on both show at the top.' },
          {
            kind: 'list',
            items: [
              '`N` — next drill, `Shift+N` — previous drill.',
              'A screen briefly interrupts wherever a drill changes, announcing the next drill’s name.',
              'When a phase changes, its name is announced too.',
            ],
          },
        ],
      },
      {
        id: 'present.wake-lock',
        title: 'Keeping the screen awake',
        blocks: [
          { kind: 'p', text: 'Turn on [Settings] → [Presentation] → [Keep screen awake] and the device screen won’t auto-lock during a presentation.' },
          { kind: 'tip', tone: 'warn', text: 'If your browser doesn’t support this, it tells you so. In that case, increase the auto-lock time in your device settings instead.' },
        ],
      },
    ],
  },

  // ── Export & share ─────────────────────────────────────────────────────────────────
  export: {
    key: 'export',
    intro: 'Five ways to take what you’ve made out of the app.',
    topics: [
      {
        id: 'export.png',
        title: 'Image (PNG)',
        blocks: [
          { kind: 'p', text: '[Export] → [Image (PNG)] in the function bar. An image file you can drop right into a chat.' },
          { kind: 'p', text: '[What to export] at the top picks the range: [This step], [Selected N], or [All N].' },
          { kind: 'tip', tone: 'tip', text: 'Choosing several steps gets you one ZIP. Unzip it and the numbered PNGs come out in order.' },
        ],
      },
      {
        id: 'export.print-pdf',
        title: 'Print and PDF',
        blocks: [
          {
            kind: 'steps',
            items: [
              '[Export] → [Print · PDF].',
              'The browser’s print dialog opens.',
              'To get a PDF, choose "Save as PDF" as the destination.',
            ],
          },
          { kind: 'p', text: 'One page comes out per step, and along with the court diagram it automatically calculates and prints the equipment needed (player, ball, and cone counts).' },
        ],
      },
      {
        id: 'export.video',
        title: 'Video (MP4)',
        blocks: [
          {
            kind: 'steps',
            items: [
              '[Export] → [Video (MP4)].',
              'Choose [720p] or [1080p].',
              'Progress shows as frame count and percentage. [Cancel] is available if it’s taking a while.',
              'When it’s done, the file name and size appear. Tap [Save] and it goes to your browser’s downloads folder — on devices that support sharing, the share sheet opens instead so you can pick where it lands.',
            ],
          },
          { kind: 'tip', tone: 'warn', text: '**A video is always the whole drill** — the range selection above doesn’t apply. Browsers that can’t encode video won’t be able to make one — export from Chrome or Safari instead.' },
        ],
      },
      {
        id: 'export.link',
        title: 'Sharing as a link',
        blocks: [
          { kind: 'p', text: 'Send a short address instead of a file. Only someone with the link can open it.' },
          {
            kind: 'list',
            items: [
              '**Drill link** — inside the editor’s [Export], or [Share as link] on a drill card’s ⋮ menu.',
              '**Session link** — [Share link] on a session card’s ⋮ menu. The session and every drill in it travel together.',
            ],
          },
          { kind: 'tip', tone: 'warn', text: 'A link expires after 180 days. For anything you want to keep long-term, export it as a file too.' },
        ],
      },
      {
        id: 'export.backup',
        title: 'How this differs from a full backup',
        blocks: [
          { kind: 'p', text: 'What you export here is **one drill (or one session).** To move to a new device or protect everything you’ve made, use a different tool.' },
          {
            kind: 'list',
            items: [
              '[Settings] → [Export data] — bundles drills, sessions, settings, and the tactics board into one file.',
              '[Settings] → [Import data] — opens that file on another device.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'Open a single drill file from [Import] on the [Drills] screen; open a full backup file from [Settings]. Drop it in the wrong place and it tells you where to go instead.' },
        ],
      },
    ],
  },

  // ── Rules ─────────────────────────────────────────────────────────────────────────
  rules: {
    key: 'rules',
    intro: 'Read the powerchair football rules by topic, and see rulings play out as board scenes.',
    topics: [
      {
        id: 'rules.topics',
        title: 'Reading the topic cards',
        blocks: [
          { kind: 'p', text: 'The rules screen starts with a list of topic cards. Each card’s badges show what it holds — **N diagram(s)**, **N scene(s)**, [Table], [Card list], [18 Laws].' },
          { kind: 'p', text: 'Opening a card runs that topic’s explanation, diagrams, and scenes together on one screen. Move around with [Back to list], [Previous topic], and [Next topic] at the top.' },
        ],
      },
      {
        id: 'rules.scenes',
        title: 'Scene playback and the comparison table',
        blocks: [
          { kind: 'p', text: 'Tap [Play scene] and that ruling situation plays out on the board, step by step. The controls are the same ones used in presentation — play, previous, next, loop, speed.' },
          { kind: 'p', text: 'In the seven-restart comparison table, **picking a column plays that scene right below it.**' },
          { kind: 'tip', tone: 'tip', text: 'Playing a scene in slow motion shows exactly when a distance ring gets triggered. When a rule is hard to explain in words, show the team this screen instead.' },
        ],
      },
      {
        id: 'rules.laws',
        title: 'The 18 Laws appendix and card list',
        blocks: [
          { kind: 'p', text: '[18 Laws] is a condensed reference of the official rulebook. Use it to look up a law by number.' },
          { kind: 'p', text: 'Caution (yellow card) and sending-off (red card) reasons are also laid out as lists.' },
        ],
      },
      {
        id: 'rules.overlay',
        title: 'Rule warnings during editing and presenting',
        blocks: [
          { kind: 'p', text: 'Rule judgment isn’t confined to the Rules screen. If a board goes outside the regulations while editing or presenting, you’re told.' },
          {
            kind: 'list',
            items: [
              'Two or more from the same team within 3 m of the ball — a 2-on-1 warning.',
              'The opponent within 5 m of the ball at a set piece — the 5 m limit.',
              'Three or more defenders in the goal area — a 3-player foul.',
              'The ball fully crosses the boundary — out of play.',
            ],
          },
          { kind: 'tip', tone: 'warn', text: 'These warnings are tied to the [Show goal-area guide] switch. Turn it off and there’s no ruling to make, so no warnings appear either.' },
        ],
      },
    ],
  },

  // ── Settings & data ──────────────────────────────────────────────────────────────
  settings: {
    key: 'settings',
    intro: 'Set these once and keep using them. Most only live on this device.',
    topics: [
      {
        id: 'settings.screen',
        title: 'Display',
        blocks: [
          {
            kind: 'list',
            items: [
              '[Theme] — [Dark] or [Light]. Pick whichever matches your gym lighting.',
              '[Show grid] — overlays a coordinate grid on the editor court.',
              '[Show grid cell labels] — writes a coordinate name on every grid cell too.',
              '[Show goal-area guide] — highlights the max-2-players rule zone on the court.',
              '[UI scale] — makes screen elements bigger on gym tablets and the like.',
            ],
          },
          { kind: 'tip', tone: 'warn', text: '[Show goal-area guide] also turns rule-violation alerts on and off together with itself.' },
        ],
      },
      {
        id: 'settings.playback',
        title: 'Playback',
        blocks: [
          {
            kind: 'list',
            items: [
              '[Step transition speed] — the interval it auto-advances during presentation.',
              '[Loop at the last step] — jumps back to the first step when it ends.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'This is the default — during a presentation you can still change speed and loop on the fly with their own buttons.' },
        ],
      },
      {
        id: 'settings.roster',
        title: 'The roster moved to [Teams]',
        blocks: [
          { kind: 'p', text: '[Roster] used to live here in the settings. It moved to the [Teams] screen, because a roster that assumed a single team now belongs to each team separately.' },
          { kind: 'p', text: 'The [Open teams] row left behind in the settings takes you there. The roster you already had was moved into one team on first launch — there is nothing to retype.' },
          { kind: 'tip', tone: 'tip', text: 'Teams ship with full backups, and they sync across devices too once Drive sync is turned on.' },
        ],
      },
      {
        id: 'settings.present',
        title: 'Presentation',
        blocks: [
          {
            kind: 'list',
            items: [
              '[Keep screen awake] — stops the device screen from auto-locking during a presentation.',
              '[Auto fullscreen] — tries to enter fullscreen automatically when you open the presentation screen.',
            ],
          },
        ],
      },
      {
        id: 'settings.a11y',
        title: 'Accessibility',
        blocks: [
          {
            kind: 'list',
            items: [
              '[Large touch targets] — buttons, tray chips, and the on-court grab radius all grow (text size is handled separately by [UI scale]).',
              '[Two-zone mode] — grabbing anywhere on the chair moves it as a whole. Spinning in place and towing only happen through guides outside the chair.',
              '[Drop sound & vibration] — a short cue when placing, blocking, or returning something to the tray.',
              '[High contrast · forced colors] — there’s no switch. Turn on your device’s setting and the app follows automatically.',
              '[Reduce motion] — turns off transition animation. Advancing a step jumps objects straight to their next position.',
              '[Editor shortcuts] — [Single key], [Needs modifier], or [Off].',
              '**Skip to main content** — no switch for this one. The first `Tab` press reveals a [Skip to main content] link at the top left so you can jump past the rail, and every screen change is announced by name.',
            ],
          },
          { kind: 'tip', tone: 'warn', text: 'If [Editor shortcuts] is set to [Needs modifier], tool letter keys need `Alt` held down too; set to [Off], letter keys don’t work at all. **If shortcuts seem broken, check here first.**' },
        ],
      },
      {
        id: 'settings.physics',
        title: 'Physics fine-tuning',
        blocks: [
          { kind: 'p', text: 'The four-zone boundaries and speed limits for dragging a wheelchair. Tap [Advanced] to expand it. **The defaults are plenty for most teams.**' },
          {
            kind: 'list',
            items: [
              '[Rear-tow boundary] / [Spin-in-place start] / [Front-tow start] — the boundaries deciding which grip on the chair does which action.',
              '[Forward/back speed limit] / [Spin (front bumper) speed limit].',
              '[Editing speed multiplier] — multiplies the speed for both dragging and continuing after a drop.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'Changing one value automatically pushes its neighbors to keep them in order. Tap [Restore defaults] if things get tangled. Values you set still apply even after you close this drawer.' },
        ],
      },
      {
        id: 'settings.data',
        title: 'Data — backup and restore',
        blocks: [
          {
            kind: 'steps',
            items: [
              'To export, go to [Export data] → [Export]. Drills, sessions, settings, and the tactics board all go into one file.',
              'To import, go to [Import data] → [Choose file].',
              'In the confirmation dialog, decide [Also restore settings] and [Replace tactics board], then tap [Read].',
            ],
          },
          { kind: 'p', text: '**Drills and sessions are added as copies** — nothing already on this device is deleted. When it’s done, a one-line report says how many came in and what happened to settings, the tactics board, and the roster.' },
          { kind: 'tip', tone: 'warn', text: 'Turn on [Also restore settings] when you’re moving devices. Leave it off and this device keeps its own theme, UI scale, and similar values. If you’re editing the tactics board, it stays as it is unless you turn on [Replace tactics board].' },
        ],
      },
      {
        id: 'settings.sync',
        title: 'Google Drive Sync',
        blocks: [
          { kind: 'p', text: 'Keeps drills, sessions, and teams in **your own Google Drive’s app-only space**, shared across devices. There is no SPIN server.' },
          {
            kind: 'steps',
            items: [
              'Tap [Connect Google account] and a dialog explains what goes up and where it’s stored.',
              'Consent by tapping [Connect and turn on].',
              'It syncs on its own most of the time. To force it right now, tap [Sync now].',
              'If the connection expires, tap [Reconnect]; to stop using it, tap [Disconnect].',
            ],
          },
          { kind: 'tip', tone: 'warn', text: 'Settings and the free tactics board never go up. [Disconnect] leaves this device’s data untouched. [Delete Drive data] erases every file on the Drive side and turns sync off, and **it cannot be undone** (drills on this device stay).' },
          { kind: 'tip', tone: 'warn', text: 'If you edited the same drill on two devices, the **most recently edited** one wins and the other is overwritten. A deletion wins the same way: delete it on one device and, if that happened later, it disappears on the other too. Run [Sync now] before you start a big editing session.' },
          { kind: 'tip', tone: 'tip', text: 'If syncing fails, read the message on screen — reconnect with [Reconnect] when the connection has expired, free up space when Drive is full, and simply wait when the network is down: it retries by itself once you are back online.' },
          { kind: 'tip', tone: 'tip', text: 'On the desktop app the sign-in window opens in your **default browser**, not inside the app itself. The buttons and wording are the same.' },
        ],
      },
      {
        id: 'settings.tutorial-reset',
        title: 'Watching the walkthroughs again',
        blocks: [
          {
            kind: 'list',
            items: [
              '[Help & tutorial] → [Replay all] — replays every screen’s first-visit tour from scratch. It shows automatically when you open each screen.',
              "[Show the small-screen notice again] → [Show again] — undoes a previous tap of [Don't show this again on this device].",
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'To replay just one screen’s tour, use the replay-tour button at the end of that screen’s section in Help.' },
        ],
      },
      {
        id: 'settings.legal',
        title: 'Legal notices',
        blocks: [
          { kind: 'p', text: 'Read the [Privacy Policy] and [Terms of Service] right inside the app. [Settings] takes you back.' },
          { kind: 'tip', tone: 'tip', text: 'If there’s no document in your current language, it says so — try opening it again after switching languages.' },
        ],
      },
    ],
  },

  // ── Shortcuts ───────────────────────────────────────────────────────────────────────
  shortcuts: {
    key: 'shortcuts',
    intro: 'The keyboard makes everything much faster. Read “How shortcuts work” below first.',
    topics: [
      {
        id: 'shortcuts.how',
        title: 'How shortcuts work',
        blocks: [
          { kind: 'p', text: 'SPIN looks at **where a key sits, not what letter is printed on it.** That gives you the following.' },
          {
            kind: 'list',
            items: [
              '**It doesn’t care about your keyboard’s input language.** The same physical key does the same thing even while typing in another script.',
              '**Labels follow a QWERTY key-cap printing.** `V` means the key printed V on that layout.',
              '**On a Mac, ⌘ takes the place of `Ctrl`.**',
            ],
          },
          { kind: 'h', text: 'Three cases that look like shortcuts aren’t working' },
          {
            kind: 'steps',
            items: [
              '**A text field has focus** — with the cursor in a name, note, or number field, letter keys type letters instead. Only saving still works. Tap the court or empty space to move focus away.',
              '**A button still has focus** — right after tapping a button, `Space` and `Enter` go to that button first. This is there to stop an accidental double-trigger.',
              '**A setting is blocking it** — if [Settings] → [Accessibility] → [Editor shortcuts] is set to [Needs modifier], letter keys need `Alt`; set to [Off], letter keys don’t work at all.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'If none of the three apply and it still doesn’t work, use [Key diagnostics] below to see exactly what was pressed.' },
        ],
      },
      {
        id: 'shortcuts.editor',
        title: 'Drill editor shortcuts',
        blocks: [
          { kind: 'p', text: 'These work anywhere on the editor screen (as long as no text field has focus).' },
          { kind: 'keys', scope: 'editor' },
        ],
      },
      {
        id: 'shortcuts.object',
        title: 'Keys used after selecting an object',
        blocks: [
          { kind: 'p', text: 'The keys below only work **while an object has focus.** Select one on the court first.' },
          { kind: 'keys', scope: 'object' },
        ],
      },
      {
        id: 'shortcuts.board',
        title: 'Free tactics board shortcuts',
        blocks: [
          { kind: 'p', text: 'The board has no steps, so step- and playback-related keys are missing. Everything else matches the editor.' },
          { kind: 'keys', scope: 'board' },
        ],
      },
      {
        id: 'shortcuts.present',
        title: 'Presentation shortcuts',
        blocks: [{ kind: 'keys', scope: 'present' }],
      },
      {
        id: 'shortcuts.diagnose',
        title: 'Key diagnostics — checking a broken shortcut yourself',
        blocks: [
          { kind: 'p', text: '[Key diagnostics] shows exactly **how the app received** the key you just pressed. It never intercepts keys here, so press anything you like.' },
          {
            kind: 'steps',
            items: [
              'Open [Key diagnostics] and press any key.',
              '[Physical key (code)] is that key’s position — judging is done off this value.',
              '[Character (key)] is the character your current input method actually produced.',
              '[Modifiers] shows the state of `Ctrl`, `Shift`, `Alt`, `⌘`, and [IME composing] shows whether a word is being composed right now.',
              '[Bound action] is the feature actually tied to that combination. [None] means nothing is bound.',
            ],
          },
          { kind: 'tip', tone: 'tip', text: 'Even if [Character (key)] shows a character from another input method, **it’s normal as long as [Physical key (code)] matches.** If the action still doesn’t fire, just report the values shown on this screen — it’s the fastest clue to finding the cause.' },
        ],
      },
    ],
  },
};
