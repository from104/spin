# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog], and this project follows [Semantic Versioning].

## [0.6.3] 2026-09-05

### Added

- Added a spin-kick loading screen on first launch and when switching between the main menus (tap the screen or press any key to skip)
- Added a notice that phones and tablets under 7 inches are not recommended ([Don't show this again] option, restore it from [Settings])

## [0.6.2] 2026-09-04

### Added

- Clicking the version number shows the changelog modal, with buttons to browse other versions
- Added freehand drawing to [Draw] in drill editing (vector strokes, arrowhead/rotation/color via anchors, 3 width levels)
- Added [Erase] next to [Note] (deletes an object on tap, tap empty space, tap again, or Esc to return to select)
- Added 6 diagrams to the [What is powerchair football?] and [The object of the game] cards (classification quota, rules lineage, match time, ball-stuck call, goal specs, goal height limit)

### Changed

- Unified header title/subtitle to center alignment across all screens, enlarged text
- Restored the header on the board screen, added a [+ Edit as drill] button on the right
- Added centered card titles and a [← Back to list] button to the [Rules] header
- Rewrote the [What is powerchair football?], [The object of the game], and [Players, court, ball, equipment] cards (Korean only for now)
- Removed the wheelchair equipment diagram from [Players, court, ball, equipment], the wheelchair drawing from the distance diagram, and the pressure panel from the ball diagram
- Replaced 2 scene examples on the [2-on-1 violation] card
- Reorganized the foul descriptions on the [Other offenses] card, tidied up its scene examples

## [0.6.1] 2026-09-02

### Added

- Added search engine visibility for rule pages (per-language URLs, preview cards on link shares)

### Changed

- Moved language selection to the globe icon in the left rail, removed the language section from settings
- Split [Fine-tune] into a translucent pad, improved visibility of the object while adjusting

### Fixed

- Fixed old shared links (`#/rules/…`) not redirecting automatically

## [0.6.0] 2026-09-01

### Added

- Added 4 demo scenes to [Rules] (including a goalkeeper-exemption update and a contested-touch call)
- Added English support for [Rules] (all 9 cards, based on the FIPFA original)
- Added Japanese support for [Rules] (using locally established terms, includes Japan's history)
- Added a "What this game leaves behind" section to [The object of the game] (citing participation-impact research)
- Added the [What is powerchair football?] and [The object of the game] cards, placed first
- Added a base-plate graphic to the goal (matching real-world specs)
- Added a fine-nudge pad (precise direction/rotation control without a keyboard)
- Added click-to-reset for goals pushed out of place

### Changed

- Reorganized [Rules] from 8 to 9 cards ([Contested] card retired, its content merged into [Restarts])
- Rewrote all nine [Rules] cards (corrected mistranslated wording, added a source link on the official rule book card)
- Adjusted the wheelchair move/rotate hit-zone ratio (rear 2/3 moves, front 1/3 rotates)
- Changed handle drags so rotation takes priority over movement
- Updated wheelchair size to the measured real-world value (1.30×0.80m)
- Removed the "add step" button from the step sidebar
- Moved the [Info] button to the top of the right function bar
- Centered the title on the drill editor and present screens

### Fixed

- Fixed a mislabeled penalty-kick exception (a second touch by hand is a stiffer penalty, not an exception)
- Filled in missing [Rules] clauses (ball may only be touched by the chair, PF1/PF2 classification, allowed tackle range, out-of-play conditions)
- Fixed inconsistent [Rules] notices when using a non-Korean language
- Fixed factual errors in [Rules] (restart method count, indirect-free-kick offense list, card summary mismatches)
- Fixed the settings [Spin-start threshold] slider not reflecting its default value
- Added court shape/size descriptions to [New Drill] and [Board Settings] (shown always instead of only in tooltips)
- Fixed the roster in settings not updating after syncing from another device
- Fixed the [Reset Goal] button not responding
- Fixed drill edits not appearing immediately in the drill list

## [0.5.99] 2026-08-28

### Added

- Added the [Rules] screen (8 topic cards with explanations, diagrams, and board animations, instead of clause order)
- Added a comparison table for the 7 restart types
- Added exception scenes to the [2-on-1] card (goalkeeper exemption, evasive exit, etc.)
- Added clause diagrams to Laws 1, 2, and 4 (court dimensions, surface, ball size, pressure, equipment)

### Fixed

- Fixed character shortcuts not responding on devices that don't report physical key names
- Swapped keyboard move/rotate step sizes with Shift (fine by default, large with Shift)
- Moved the [Drill Info] button to the right function bar, gave editing and presenting distinct icons
- Moved [Clear] into the [Board Settings] modal, added it to drill editing too (clears only the current step)
- Added undo support for [Clear] and court switching on the tactics board
- [Save] on the tactics board now asks for a name and opens the new drill for editing right away
- [New Drill] now asks for a name and court up front
- Consolidated court/goal board actions into a single [Board] button

## [0.5.0] 2026-08-21

### Added

- Added optional Google Drive sync (share drills, sessions, and rosters across devices)
- Added Korean/English/Japanese support (auto-detect, including print and PNG output)
- Added team name editing in drill editing
- Added notes and rest-time input to sessions
- Added a delete safety net for steps, drills, sessions, and session sections (undo and confirmation)
- Added player name display in print and PNG output
- Added note font size and color options
- Added a first-visit tutorial and help for each screen

### Changed

- Unified the drill editor and present screen layouts
- Added a right-side vertical function bar to the present screen
- Added a pen icon to the [To Editor] button
- Removed the [Save] slot from the drill editor function bar (replaced by autosave)
- Cleaned up the note layout at the bottom of drill editing
- Moved full data export into the settings screen
- Reduced the drill list card width

### Removed

- Removed the [Default Formation] and [Default Court Mode] settings items
- Removed team color selection from settings (now a fixed standard palette)

### Fixed

- Fixed arrows being hidden behind shapes in thumbnails
- Fixed jitter in the step list selection mode UI, added long-press to open the selection menu on touch

## [0.3.0] 2026-08-19

### Added

- Added a list view to the drill library, reduced card thumbnail size
- Moved [Drill Info] into a centered modal opened from an icon beside the bottom note
- Made the present screen's [To Editor] button go to the actual editor
- Added a [Present] button to the bottom of drill editing
- Added drill info viewing while presenting
- Changed present-screen notes to match the editor's note style
- Changed the drill classification system (added type/situation axes, reworked description fields)
- Added section structure to sessions (warm-up, technical, tactical, etc.)
- Added roster storage for players
- Gave every screen its own address (refreshing keeps you on the same screen)
- Promoted sessions to their own screen in the left rail
- Added a dedicated session editor (arrange drills by section, shows target time)
- Made drill info directly editable from the editor
- Added roster and session participant checklists
- Added section progress display to the present screen
- Added situation filtering and sorting to the drill library
- Redesigned step editing as a left-side vertical bar
- Added step duplication, linking, and multi-select
- Added a step note panel
- Added shape and note previews to list cards and step thumbnails
- Added a right-click menu to step cards (select, duplicate, delete)
- Added a rotation anchor to arrows
- Added right-click duplication for board objects (shapes, notes, arrows)
- Made the drill name directly editable in the editor

### Changed

- Consolidated the bottom of the editor into a single note (moved the step list to the left bar)
- Reduced the left step bar width, enlarged the court area
- Retired the step name field (existing content moves to the note automatically)
- Enlarged object previews on list cards and step thumbnails
- Fixed arrows being hidden behind shapes in thumbnails

## [0.2.1] 2026-08-17

### Added

- Added a 5m restriction marker around the ball for set-piece restarts (encroachment calls)
- Widened the 2-on-1 goalkeeper exemption (also applies once fully past the goal line)
- Added click-to-cycle line color on arrow bend points (sky, yellow, red)

### Fixed

- Fixed drawn shapes and side markers missing from PNG export
- Fixed missing side markers and half-filled courts in print output

### Changed

- Changed exported image background to black, caption text to white

### Removed

- Removed the [Properties] button and panel (inputs moved to the header and left bar; some fields temporarily have no editing spot)

## [0.2.0] 2026-08-17

### Added

- Added drawing shapes (circle, equilateral triangle, square)
- Added a right-click menu on objects (edit, lock, ignore, delete)
- Made notes editable and line-breakable right where they're placed
- Added side flag markers
- Added mouse-wheel zoom on the court
- Added click-to-cycle ball distance rings (3m, 5m)
- Added a tactics-board session cache (keeps state on return)
- Unified the app icon and favicon

### Changed

- Merged the court and bench into a single board, removed the gap
- Redesigned the tactics board (removed the properties panel, consolidated into a right-side function column)
- Changed the tray to dock along the court's long edge
- Removed the top header on wide screens
- Overhauled the shortcut system (physical-key based), removed the eraser tool
- Redesigned multi-select (rubber-band selection, drag to move as a group)
- Made placement tools single-use by default (hold the tool to place repeatedly)
- Unified the object delete shortcut to Delete
- Added a preview of the outcome when dropping on the tray ("drop to remove/delete")
- Simplified arrows to a single line, added click-to-cycle arrowheads on both ends
- Changed foul detection to use the chair's full rectangle instead of a point (widened detection range)
- Changed goal-area fill to a two-stage per-side display
- Introduced sides (team-to-goal assignment), applied to goalkeeper exemption and goal-area calls
- Enlarged the center mark, also shown on half courts
- Moved toast notifications from the bottom to the top of the screen
- Reduced wheelchair chip size (44×60→44×44), moved undo/redo controls
- Made the [Board] rail item always open the free tactics board

### Fixed

- Fixed left-click actions firing along with right-click
- Fixed the browser's context menu appearing over the court
- Fixed locked objects being pushed by others, and lock badges drawing underneath objects
- Fixed ignored objects being unselectable and unable to open their right-click menu
- Fixed the draw and note trays failing to open
- Fixed the board rotating in portrait mode on iPad
- Fixed the last edit disappearing on screen switches
- Moved the [Reset Goal] button from the confirmation dialog to the inspector
- Fixed Esc intercepting Korean IME composition in modals, and the background stealing focus

## [0.1.0] 2026-08-13

### Added

- Added a device-move (full backup) file covering drills, sessions, settings, and the tactics board
- Added PNG export
- Added print (PDF) export (session plans, drill sheets)
- Added black-and-white print and color-vision support (dashed borders on the opposing team's chips)
- Added iPad share sheet support
- Added 3 court sizes (30×18m, 28×15m, 25×14m)
- Added corner-kick encroachment marks (per the 2025 rules)
- Added a center mark
- Added auto-arrangement for set-piece starting positions
- Added a 3m call ring around the ball and a 3-player goal-area call
- Widened the object hit zone (recognized within 44px even off-target, except for the eraser)
- Added keyboard movement for arrows
- Added Esc to deselect, and re-tap to deselect a selected object
- Added a lifted shadow effect when picking up an object
- Added board-edge and Ctrl+arrow-key panning
- Added a photo-stack scrubber for flipping through steps
- Added 2-zone mode (accessibility: move the whole chair as one)
- Added sound and vibration feedback when placing an object
- Added coaching fields (objective, coaching points, players needed, equipment, repeat sets)
- Added player name display
- Added step name, note, and time input
- Added a present shortcut on drill cards
- Added high-contrast and forced-colors mode support

### Changed

- Reduced the menu to 3 tiers: [Board], [Drills], [Settings]
- Changed the inspector to an overlay (no longer affects board size)
- Trimmed the first-screen control count to 40 or fewer
- Split the tray into 2 drawers: draw and notes
- Moved 6 physics values in settings into a closed drawer
- Removed the center circle (not part of the rules)
- Consolidated export into a single entry point
- Removed the home dashboard (next-session info moved to the sessions tab)
- Enlarged the tray to match bigger touch targets (93→117px)
- Changed the tray from a toolbar to an object bin (player parking slots, ball/cone boxes)
- Split cones into color-coded boxes, changed cone color (pink→blue)
- Adjusted max ball count (10→8), 8 per cone color
- Removed the movement speed limit for balls and cones
- Unified player facing to vertical when first placed on the court
- Made tray chips match the look of court chips
- Simplified wheelchair control zones to 2: move and rotate
- Reduced chip number and goalkeeper badge size
- Simplified the guide shown on object selection
- Consolidated tools and objects into the right-side tray
- Added board panning (double-click then drag)
- Added an object movement speed limit switch
- Added a version display at the bottom of the left rail

### Fixed

- Fixed overlapping wheelchairs not auto-spreading apart
- Fixed objects snapping away instead of returning to the release point
- Fixed pushed wheelchairs getting stuck outside the board
- Fixed the board partially freezing during editing
- Fixed the note tool not responding when placed
- Fixed tray chip keyboard activation
- Fixed front buttons shifting when opening a drawer in portrait mode
- Fixed self-made backup files being rejected as malformed
- Fixed the settings physics zone sliders not affecting actual calls
- Fixed the settings "repeat on last step" option not working
- Fixed the present screen losing team distinction in high-contrast mode
- Fixed the present progress bar and main button being invisible in high-contrast mode
- Fixed wording errors in settings descriptions
- Fixed deleted balls/cones still counting against the placement cap
- Fixed the settings zone-boundary default getting clipped on save

## [0.0.1] 2026-08-10

### Added

- Added the free tactics board (full/half/flat court switching)
- Implemented wheelchair drag kinematics (position-based move/rotate split)
- Added the drill editor (place players, balls, cones, arrows, and notes; step-based design)
- Added a grid overlay
- Added present mode (fullscreen, swipe navigation, continuous session playback)
- Added local storage (no server, JSON export/import)
- Added tablet support (orientation-aware layout, PWA home-screen add)
- Added goal physics and a [Reset Goal] button
- Added keyboard accessibility (object move/rotate, focus indicators, configurable shortcuts)

### Changed

- Added a push effect when wheelchairs collide
- Tuned ball/cone mass and damping to real-world values
- Widened the court's outer margin (1.0m→1.5m)

### Fixed

- Fixed objects snapping back to their previous position when picked up again
- Fixed the drag handle not following the object during a move
- Fixed off-body front/rear handles not responding
- Fixed the drag connector line originating from the rotation axis instead of the grabbed point
- Fixed rotation failing when dragged at an angle
- Fixed the previous layout briefly showing when switching session drills
- Fixed a rotated court covering tools in portrait mode
- Fixed the court outline not following margin changes
- Fixed pushed-goal recovery failing when blocked by a wheelchair

<!-- Links -->

[keep a changelog]: https://keepachangelog.com/en/1.0.0/
[semantic versioning]: https://semver.org/
