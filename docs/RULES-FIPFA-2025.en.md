# FIPFA Powerchair Football — Laws of the Game, condensed (English canonical)

> Source: FIPFA (Fédération Internationale de Powerchair Football Association)
> *Laws of the Game — Official Rules & Regulations*, **approved April 2025** (current edition).
> Original PDF: https://fipfa.org/wp-content/uploads/2025/06/FIPFA-Laws-of-the-Game-2025.pdf
> (Classification detail lives in a separate document, *FIPFA 2025 Classification Rules*:
> https://fipfa.org/wp-content/uploads/2026/04/FIPFA-2025-Classification-Rules.pdf )
>
> **This is a condensed restatement of the 50-page original, not a reproduction and not a
> substitute for it.** Where a decision turns on exact wording, read the original PDF.
>
> **Why this file exists.** The app's rules screen is Korean-only. Making it available in English
> is *not* a translation job: `docs/RULES-FIPFA-2025.md` is itself a Korean **summary** of this
> English original, so translating it would mean English → Korean → English. English app content
> must be written from **this** file, which is written from the original.
> See `docs/PLAN-RULES-9CARDS.md` §9.
>
> **Same discipline as the Korean canonical**: app text is derived from this document. Changing
> app strings without changing this file first is not allowed.

## How the original was read

The official PDF cannot be text-extracted naively — its fonts draw `ti`, `tt`, `ft` and `ct` as
single glyphs with no Unicode mapping, so a plain `pdftotext` run silently **deletes** those
letters (`Regula ons`, `a acking`, `Compe on`, `at the me of`). `scripts/extract-fipfa-laws.mjs`
repairs that by dictionary lookup and prints every repair for review — 467 repairs across 163
distinct forms in the April 2025 edition. **Its output is inferred, not authoritative**; the
script's header documents a real false positive it once produced. Everything quoted below was
read in repaired form and checked for sense against surrounding text.

## At a glance

| Law | Title | App treatment |
|---|---|---|
| — | Object of the Game | text |
| 1 | The Field of Play | scene (static diagram) |
| 2 | The Ball | text |
| 3 | The Number of Players | scene (static diagram) |
| 4 | The Players' Equipment | text |
| 5 | The Referee | text (outline) |
| 6 | The Assistant Referees | text (outline) |
| 7 | The Duration of the Match | text |
| 8 | The Start and Restart of Play | scene |
| 9 | The Ball In and Out of Play | scene |
| 10 | The Method of Scoring | scene |
| 11 | Field Position (2-on-1 · 3 in the goal area) | 2 scenes |
| 12 | Fouls and Misconduct | text (foul list, cards) — ramming scene removed 2026-09-04 |
| 13 | Free Kicks | 2 scenes (direct/indirect) |
| 14 | The Penalty Kick | scene |
| 15 | The Kick-In | scene |
| 16 | The Goal Kick | scene |
| 17 | The Corner Kick | scene |
| 18 | Classification | text (outline + link) |
| — | Kicks from the Penalty Mark | text |

---

## Object of the Game

- Two teams of athletes with physical disabilities use guards attached to powered wheelchairs as
  "feet" to kick a specially designed ball.
- The objective is to move the ball over the opposing team's goal line while preventing them from
  doing the same.

**Modifications.** With the agreement of the national association concerned, and provided the
principles of the Laws are kept, these may be modified: field size · ball size, weight and
material · duration of the periods of play · substitutions. Further modifications may be agreed
between referees, coaches and tournament directors before the match or tournament.

**Safety.** Players must use lap seatbelts. Leg, feet and chest straps should be used if normally
worn. Helmets, headrests and other assistive or protective technology the athlete normally uses
are permitted.

## Law 1 — The Field of Play

- Basic size **28 m × 15 m** (a standard basketball court).
  - Length: maximum **30 m**, minimum **25 m**
  - Width: maximum **18 m**, minimum **14 m**
  - Maximum dimensions are expected for sanctioned international events.
- **Surface**: hard, smooth and level, for easy manoeuvrability. Wood or artificial material is
  recommended; concrete or tarmac should be avoided.
- **Markings**: the two longer boundaries are touch lines, the two shorter are goal lines. All
  lines are at least **5 cm** wide. A halfway line divides the field; the centre mark at its
  midpoint may be a **15 cm "X"**.
- **Goal area**: at the centre of each end, **8 m wide × 5 m deep**.
- **Penalty mark**: **3.5 m** from the goal line, equidistant from each goalpost. May be a 15 cm
  "X" or line.
- **Goals**: two upright posts (pylons or cones) at the centre of each goal line, **6 m apart**.
- **Corner kick encroachment mark**: **1 m** inside each goalpost, perpendicular to and behind the
  goal line, for positioning inside the goal area at corner kicks.
- **Officials' area**: at least **1 m** wide around the entire perimeter.
- **Corner triangle**: **1 m** from each corner, marked inside the field.
- **Technical areas**: from the top of the goal area line to the halfway line, or 1 m from the
  scorer's table, extending to the edge of the officials' area.

## Law 2 — The Ball

**Qualities and measurements.** The ball is spherical, and at a pressure recommended by the
manufacturer that **minimises bouncing yet prevents powerchairs from riding over it**.
That is the whole of it — the Laws state **no diameter or weight**; the FIPFA Technical Supplement
covers the rest.

**Replacement of a defective ball.** If the ball bursts or becomes defective **during play**, the
match stops and restarts with a **set ball** where the ball first became defective (Law 8). If it
bursts while **not in play** at a kick-off, goal kick, corner kick, free kick, penalty kick or
kick-in, that restart is simply taken again. The ball may not be changed during the match without
the referee's authority.

## Law 3 — The Number of Players

- Two teams of **not more than 4 players**, one of whom must be a goalkeeper. A match may not
  start or continue if a team has **fewer than 2 players**.
- Players must have **adequate control** of their powerchairs; the referee may stop a player who
  is not in full control from taking part.
- **Official competitions**: 4 players plus up to **4 substitutes**. More substitutes require both
  teams to agree a maximum *and* the referee to be told before the match; otherwise 4 is the cap.
  Team sheets go to the referee before the match, and players not named may not take part.
- **Substitution procedure**: the 4th official or nearest assistant referee is told before the
  next stoppage; the assistant signals and the centre referee acknowledges; the change happens
  only with the centre referee's permission at the next appropriate stoppage; the outgoing player
  leaves at or near their technical area; the substitute enters **at the halfway line** only after
  the teammate has left; the substitution is complete once the outgoing player is safely in the
  technical area and the substitute is on the field.
- **A team may not substitute the goalkeeper for a penalty kick** unless there has been an injury
  or equipment failure.
- **Changing the goalkeeper**: any player may change places with the goalkeeper under the same
  notify-signal-permission sequence.
- **Infringements**: a substitute entering without permission is cautioned for unsporting
  behaviour and ordered off; if play was stopped, it restarts with an indirect free kick to the
  opponents from where the ball was (Law 13). Other infringements of this Law: those concerned are
  cautioned and play restarts with an indirect free kick from the ball's position.
- **Sent off**: a player sent off **before** the kick-off may be replaced by a named substitute.
  A named substitute sent off — before or after the start — **may not** be replaced.

## Law 4 — The Players' Equipment

- **Safety**: nothing dangerous to the player or to others.
- **Basic compulsory equipment**: jersey or shirt (team colours contrasting the opponents') ·
  shorts or warm-up pants matching the team · a powered wheelchair · **lap seatbelt** ·
  **frontguard** · a clear visible number on the rear of the chair and on the front of the chair
  or player.
- **Powerchair**:
  - **4 or more wheels**. Three- or four-wheeled scooters and similar equipment are not permitted.
  - Maximum speed during the match **10 kph (6.2 mph), forward and reverse**.
  - No backpacks or bags attached (essential medical equipment — oxygen, feeds, ventilators — is
    excepted).
  - No sharp surfaces or items that might entangle other chairs.
  - Chest/shoulder/head restraints are **required** for athletes who need them.
  - **Lateral side supports on both sides**.
  - No part of the chair, seat, headrest **or player** may overhang the front or rear of the chair
    base.
  - No part of the chair may be built to **trap or hold the ball**; attachments that stop the
    wheels trapping or riding over the ball are encouraged.
- **Guards**: unbreakable material, securely attached · the player must keep eye contact with the
  ball · surfaces solid, **not angled to lift the ball** · flat or convex only (**no concave**) ·
  no sharp surfaces or protrusions · not wider than the widest point of the frame or wheelbase ·
  the front guard not narrower than the front casters.
  **A mark 13 inches back from the front** of the front guard denotes the legal playing area for
  fair tackles.
- **Goalkeepers** wear colours distinguishing them from other players; bibs should be avoided.
- **Infringements**: play need not stop. The player is sent off the field to fix the equipment,
  leaves when the ball is next out of play, and re-enters only with the referee's permission and
  check, when the ball is out of play. Entering without permission earns a caution (yellow card).
  If play was stopped to caution, it restarts with an indirect free kick to the opponents.

## Law 5 — The Referee (outline)

One referee controls each match with **full authority** to enforce the Laws. Powers and duties
include: enforcing the Laws with regard to safety and sportsmanship · working with the assistant
referees · checking field, ball and equipment · collecting and verifying team sheets · acting as
**timekeeper** and keeping a match record · stopping, suspending or abandoning the match at
discretion, for outside interference, for serious injury, for a dangerous situation, or when a
player is in danger of flipping over or major chair components fall onto the field · playing
advantage and penalising the original offense if the advantage does not come · punishing the more
serious offense when several are committed at once · taking disciplinary action (not necessarily
at once, but by the next stoppage) · acting on assistant referees' advice for what was not seen ·
providing a match report.

If a player's equipment breaks down and there is no danger, play continues until the ball is out
of play; at the stoppage the referee allows **time for repair**, and orders a substitution if the
repair time is significant.

**Decisions of the referee on facts connected with play are final** — including whether a goal was
scored and the result — and may be changed only on realising an error, or on an assistant's
advice, and only before play has restarted.

## Law 6 — The Assistant Referees (outline)

Assistant referees may be appointed to indicate: when the whole ball has passed over a touch line
or goal line · which side gets a corner kick, goal kick or kick-in · when a substitution is
requested · when a team has **exceeded the allowed number of players in the goal area** · when a
player other than the goalkeeper has **completely crossed the goal line between the posts** ·
misconduct out of the referee's view · offenses where the assistant is closer to the action ·
at penalty kicks, whether the goalkeeper moved before the kick and whether the ball crossed the
line.

## Law 7 — The Duration of the Match

- **Two equal periods of 20 minutes**, unless the referees and both teams agree otherwise before
  the start (for example 15-minute halves) and competition rules allow it.
- **Half-time interval: maximum 10 minutes.** Competition rules state its duration; it may be
  changed only with the referee's consent.
- **Allowance for time lost** in either period for: stoppages for a player's safety (danger of
  falling; major chair parts on the field near play) · removal of a non-operable chair for repair ·
  assessment and removal of injured players · **wasting time** · any other cause. The allowance is
  at the referee's discretion.
  If equipment breaks down during play and safety is not jeopardised, play may continue; at the
  next stoppage the referee allows repair time, and orders a **mandatory substitution** if the
  repair takes excessive time.
- **Penalty kick**: if one has to be taken or retaken, the half is extended until it is completed.
- **Abandoned match**: replayed, unless competition rules say otherwise.

## Law 8 — The Start and Restart of Play

**Preliminaries.** A coin toss; the winner chooses to kick off or which goal to attack. Teams
change ends at half-time.

**Kick-off** starts or restarts play at the start of the match, after a goal, at the start of the
second half, and at the start of each period of extra time. **A goal may be scored directly from
the kick-off.**

Procedure: all players in their own half · opponents at least **5 m** from the ball until it is in
play · ball stationary on the centre mark · referee's signal · the ball is in play **when it is
kicked and moves** · the kicker does not touch it a second time until another player has · after a
goal, the other team kicks off.

Infringements: second touch by the kicker → **indirect free kick** to the opponents where the
infringement happened. An opponent inside the required distance who touches the ball when it is
kicked → the ball is moved to that spot, a **direct free kick** is awarded, and the opponent is
warned or cautioned. Any other infringement → the kick-off is retaken.

### Set ball

A **set ball** restarts the match after a temporary stoppage that becomes necessary **while the
ball is in play**, for any reason not mentioned elsewhere in the Laws.

Procedure: the referee places the ball where play stopped. **One player from each team** stands
equally distant and **no further than 30 cm** from the ball, both **facing the ball parallel with
the touchline**, until the ball is touched. **All other players at least 3 m** away until the ball
is in play. Play restarts on the referee's signal.

Infringements — the ball is set again if it is touched before the signal, if it rolls before the
signal, or if an uninvolved player comes within 3 m before the signal. After the signal, if one of
the two players **turns their chair** before the ball is touched, an indirect kick goes to the
opponents.

**Special circumstance**: a set ball inside the goal area is taken on the goal area line, parallel
to the goal line, at the point nearest to where the ball was.

## Law 9 — The Ball In and Out of Play

The ball is **out of play** when:

- it has **wholly crossed** the goal line or touch line, on the ground or in the air;
- it is **held immobile for more than 5 seconds** between two or more opponents in active play;
- play has been stopped by the referee;
- it **elevates above 50.8 cm (20 in)** from the floor **and**, in the referee's opinion, creates a
  **dangerous situation**.

The ball is **in play** at all other times, including when it rebounds from a goalpost and stays
on the field, when it rebounds from a referee or assistant referee on the field, and when it
elevates above 50.8 cm **without** creating a dangerous situation in the referee's opinion.

> **The ball may only be played by the players' powerchairs. It cannot be moved by contact with a
> player's body (e.g. hand, foot, or head).**

## Law 10 — The Method of Scoring

- A goal is scored when the **whole of the ball** passes over the goal line **between the posts**,
  **rolling, not carried**, provided the scoring team has not previously infringed the Laws.
- **No goal** if the ball is **elevated above 50.8 cm (20 in)** above the floor as it crosses the
  goal line.
- With no goalpost present, a goal is scored when the **majority of the ball** passes freely — not
  carried — inside the goal marking and wholly crosses the goal line.
- **Winning team**: more goals wins; equal goals, or none, is a draw.
- **Competition rules** may provide extra time or kicks from the penalty mark to decide a drawn
  match.

## Law 11 — Field Position

Two position-based violations: **2-on-1** and **3 in the goal area**. Position alone is not the
violation — criteria must be met.

> **Wording**: the original heads these sections "Offense" but calls the thing the referee whistles
> a **violation** (all five uses of the word in the Laws are here, in Law 11). Law 12's fouls are
> **offenses**. The app follows that split.

### 2-on-1

- **Position**: two teammates and an opponent within **3 m** of the ball while it is in play.
- **Offence**: penalised only if, in the referee's opinion, **both teammates and the opponent are
  involved in active play**.
- **Active play** means one of: *interfering with play* (playing or touching a ball passed or
  touched by a teammate) · *interfering with an opponent* (clearly obstructing their movement, or
  a gesture or movement that deceives or distracts them) · *gaining an advantage by being in that
  position* (playing a ball that rebounds off a post or off an opponent while in a 2-on-1
  position).
- Two teammates and an opponent within 3 m is **not** a violation until the **second** teammate
  becomes involved in active play.
- **Not a 2-on-1** if one of the two teammates is the **goalkeeper in their own goal area**, or if
  **no opponent** is within 3 m of the ball.
- **Leaving the field to avoid a 2-on-1** is allowed if, in the referee's opinion: it is done to
  allow the free flow of play · they do not re-enter until the phase of play has changed ·
  re-entry is near where they left (no tactical repositioning) · the space allows it safely · and
  it is not habitual or a deliberate strategy. Breaking these → caution for unsporting behaviour.
  A 2-on-1 **is** called if, before leaving, the player was in a 2-on-1 position and involved in
  active play.
- **Sanction**: indirect free kick to the opponents where the infringement occurred (Law 13).

### 3 in the goal area

- **Three or more teammates within their own goal area at one time**, while the ball is in play in
  their half of the field.
- **Sanction**: indirect free kick to the opponents where the infringement occurred (Law 13).
  If the violation denies a goal-scoring opportunity, Law 12 also applies.

## Law 12 — Fouls and Misconduct

**Direct free kick** to the opponents if a player **rams or attempts to ram** an opponent in a way
the referee considers careless, reckless or using excessive force; or:

- holds an opponent with the powerchair;
- handles the ball deliberately;
- uses the arms to push, hold or strike an opponent, or attempts to;
- spits at an opponent;
- denies a goal-scoring opportunity.

Taken from where the offense occurred.

**Penalty kick** if any of the above is committed by a player **inside their own goal area**,
irrespective of where the ball is, provided it is in play.

**Indirect free kick** to the opponents if:

- a player other than the goalkeeper **wholly crosses their own goal line between the posts**
  during play (**without being pushed by an opponent**);
- a **third player** enters their own goal area while the ball is in play in their half;
- or, in the referee's opinion, a player plays in a **dangerous manner**, **impedes** an opponent's
  progress, **deliberately moves or pushes over a goalpost**, or commits **any other offense not
  named in Law 12** for which play is stopped to caution or dismiss.

### Definitions (Law 12's own)

- **Tackling and fair charges are allowed as long as they are front guard to front guard.**
  Contact with any other part of the chairs, or ramming, is a foul and is **not** allowed.
- **Ramming**: deliberately driving into an opponent, with or without the ball, at high speed or
  with excessive force. The opponent may be moving or standing still.
- **Holding**: deliberately and physically restricting the movement of an opponent's powerchair.
- **Clipping** (a variation of holding): deliberately contacting the side or back of an opponent's
  powerchair to impede their progress.
- **Spin kicks** propel the ball farther and faster than running straight at it. They are exciting
  and make the sport a fine spectator game, and are **not prohibited**. But during play a spin kick
  can create a dangerous situation, because for part of the move **the kicker cannot see the ball
  or anyone approaching it**.

### Disciplinary sanctions

Players, substitutes and team officials in the technical area may all be shown a card. **Where the
offender cannot be identified, the senior team coach in the technical area receives the sanction.**
The referee's authority runs **from entering the venue until leaving it after the final whistle**.

**Cautions (yellow card) — seven offenses**: 1 unsporting behaviour · 2 dissent by word or action ·
3 persistent infringement of the Laws · 4 delaying the restart of play · 5 failing to respect the
required distance at a corner kick, kick-in, free kick, goal kick or set ball · 6 entering or
re-entering the field without permission · 7 deliberately leaving the field without permission.

**Sending-off (red card) — eight offenses**: 1 serious foul play · 2 violent conduct · 3 spitting
at an opponent or any other person · 4 denying a goal or an obvious goal-scoring opportunity by
deliberate handball · 5 denying an obvious goal-scoring opportunity to an opponent moving towards
the goal, by an offense punishable by a free kick or penalty kick · 6 denying a goal by completely
crossing the goal line (goalkeepers excepted) · 7 offensive, insulting or abusive language or
gestures · 8 receiving a second caution in the same match.

A player or official sent off must leave the **sight and sound** of the field and technical area.

## Law 13 — Free Kicks

Free kicks are **direct** or **indirect**. For both, the ball must be **stationary**, and the
kicker must not touch it again until another player has.

- **Direct** into the opponents' goal → **goal**. Into one's own goal → **corner kick** to the
  opponents.
- **Indirect** is signalled by the referee raising an arm straight above the head and holding it
  until the kick is taken and the ball is touched by another player or goes out of play. A goal
  counts only if the ball **subsequently touches another player**. Direct into the opponents' goal
  → **goal kick**; into one's own goal → **corner kick** to the opponents.

**Position.** For a **defending team's** free kick inside its own goal area: opponents at least
**5 m** away **and outside the goal area** until the ball is in play; the ball is in play when
kicked **directly out of the goal area**; the kick may be taken from **any point** inside that
area. For an **attacking team's indirect** free kick inside the opponents' goal area: opponents at
least 5 m away (unless goalkeepers are behind their own goal line between the posts); the ball is
in play when kicked and moves; the kick is taken from the **goal area line, parallel to the goal
line, nearest to where the infringement occurred**; **defenders have priority for position** in
their own goal area before the kick. Outside the goal area, a direct free kick for the attacking
team follows the same 5 m rule and is taken **where the infringement occurred**.

**Infringements.** Second touch by the kicker → indirect free kick to the opponents from that
place. An opponent inside the required distance who touches the ball → the ball is moved to that
spot and the kick **retaken** (if inside the goal area, from the goal area line nearest the
infringement), and the opponent is warned or cautioned. If a defending team's kick from inside its
own goal area is not kicked directly into play, it is retaken.

## Law 14 — The Penalty Kick

Awarded against a team that commits a **direct-free-kick offense inside its own goal area while
the ball is in play**. **A goal may be scored directly.** Additional time is allowed at the end of
each half, or of extra time, for a penalty kick to be taken.

**Position**: ball on the penalty mark · the kicker **clearly identified** · the goalkeeper who was
defending **when the kick was awarded** must defend it (**no substitution**), may face any
direction, but must remain **stationary with the whole chair behind the goal line** until the ball
is kicked · all other players inside the field, **outside the goal area, behind the penalty mark,
and at least 5 m from it**.

**Procedure**: the referee identifies the kicker, checks the goalkeeper's position and signals.
**The kicker has 15 seconds to kick the ball.** The ball is in play when it is kicked and moves.
A goal is awarded if, before passing between the posts, the ball touches a post and/or the
goalkeeper.

**Infringements** (after the signal, before the ball is in play):

- **Kicker's team** infringes → kick proceeds; if it scores, **retaken**; if not, play restarts
  with an indirect free kick to the opponents where the infringement occurred.
- **Kicker does not kick within 15 seconds** → indirect kick to the **defending** team, ball placed
  at the top of the goal line in line with the penalty spot. In a shoot-out it is recorded as a
  miss.
- **Goalkeeper's team** infringes → kick proceeds; if it scores, **goal**; if not, **retaken**.
  If the goalkeeper moves and that interferes with the kick or makes a save → **retaken and the
  goalkeeper warned**; a **second** such movement after the warning may bring a caution.
- **Both teams** infringe → retaken.

After the kick: kicker's second touch (**except with the hands**) → indirect free kick to the
opponents; deliberate handball by the kicker → **direct** free kick to the opponents; the ball
touched by an outside agent as it moves forward → retaken; the ball rebounding from the goalkeeper
or posts and then touched by an outside agent → play stops and restarts with a **set ball** at that
place (or on the goal area line, if inside the goal area).

## Law 15 — The Kick-In

A method of restarting play. **A goal can be scored directly from a kick-in.** Awarded when the
whole of the ball passes over the **touchline**, on the ground or in the air, **to the opponents of
the player who last touched it**.

> If **two opponents are simultaneously touching the ball** while driving along the touch line, the
> kick-in goes to **the player positioned on the outside trying to keep the ball in play**.

Procedure: ball placed on the touchline where it left the field · opponents at least **5 m** away
until the ball is in play · the ball is in play when kicked and moves · no second touch by the
kicker until another player has touched it · **defenders have priority for position** in their own
goal area before the kick.

Infringements: second touch → indirect free kick to the opponents there. An opponent inside the
required distance who touches the ball → ball moved to that spot, **direct free kick**, and the
opponent warned or cautioned. Any other infringement → the kick-in is taken by the opposing team.

## Law 16 — The Goal Kick

A method of restarting play. **A goal may be scored directly, but only against the opposing team.**
Awarded when the whole of the ball passes over the **goal line**, in the air or on the ground,
having last touched a player of the **attacking** team, without a goal being scored.

Procedure: kicked from **any point within the goal area** by a **defending** player · opponents at
least **5 m** away until the ball is in play · no second touch by the kicker · the ball is in play
when it is kicked **directly out of the goal area**.

Infringements: not kicked directly out of the goal area → **retaken**. Second touch after the ball
is in play → indirect free kick to the opponents there. An opponent inside the required distance
who touches the ball → ball moved to that spot, **direct free kick**, opponent warned or cautioned.
Any other infringement → retaken.

## Law 17 — The Corner Kick

A method of restarting play. **A goal may be scored directly.** Awarded when the whole of the ball
passes over the **goal line**, on the ground or in the air, having last touched a player of the
**defending** team, without a goal being scored.

Procedure: ball placed **inside the corner triangle** closest to where it crossed the goal line ·
opponents **outside** the goal area at least **5 m** from the corner triangle until the ball is in
play · opponents **inside** the goal area positioned **past the 1 m corner positioning mark**
(unless the goalkeeper is behind the goal line between the posts) · kicked by an **attacking**
player · in play when it is touched and moves · no second touch by the kicker · **defenders have
priority for position** in their own goal area before the kick.

Infringements: second touch → indirect free kick to the opponents there. An opponent inside the
required distance who touches the ball → ball moved to that spot, **direct free kick**, opponent
warned or cautioned. Any other infringement → retaken.

## Law 18 — Classification

**Role.** The FIPFA classification system places athletes into sport classes according to how much
their impairment affects the core determinants of performance in powerchair football, so that
strategy, skill and talent decide competitive success. It has a dual purpose: **(1) determine
eligibility to compete, (2) group athletes for competition.**

**Eligibility.** Powerchair football is played only by those with a **diagnosed, severe physical
impairment** leading to a verifiable, permanent activity limitation, such that the athlete **needs
powered mobility in order to play a sport**. Some variable or fluctuating impairments (for example
multiple sclerosis) may require classification at every competition.

> **Levels of fitness, age, cognition, gender or skill are not factors in classification.**
> The assessment focuses on functional performance in relation to powerchair football and the
> ability to play the sport safely.

**Sport classes.** Every eligible athlete is allocated one of **two** sport classes:

- **PF1** — a player with **highly significant** levels of physical difficulty affecting overall
  performance.
- **PF2** — a player with **moderate to mild** levels of physical difficulty affecting overall
  performance, who still meets the minimal eligibility criteria.

> **Each team cannot field more than two PF2 players during a match, for all FIPFA sanctioned
> competitions.** There is no restriction on the combination of sport classes in the squad.

**Sanction.** If a team has more than two PF2 players on the field, the referee stops the match as
soon as it is noticed, has the player removed, issues a **yellow card to the player and the
coach**, and restarts with an indirect kick to the opponents where the ball was (Law 13). If the
team cannot comply, it plays on with one player fewer.

**Sport class status**: **New (N)** — not previously evaluated by a FIPFA panel. **Review (R)** —
previously evaluated internationally but subject to re-evaluation; the class may change before or
during competition. **Confirmed (C)** — evaluated and determined not to change.

Protests (objections to a class) and appeals (objections to how classification was conducted) are
governed by the FIPFA Classification Rules. Classifiers must complete FIPFA training, including
theory, practical education, practical training and mentorship. Athletes must present for
assessment in match uniform with required documentation and equipment; the evaluation may include
physical assessment, technical assessment and observation of performance.

## Kicks from the Penalty Mark

Used where competition rules require a winner and the score is still tied after regulation and two
periods of extra time.

- The referee chooses the goal and tosses a coin; the winning captain chooses to kick first or
  second. The referee records the kicks.
- **Both teams take four kicks**, taken **alternately**, each by a **different player**; all
  eligible players must kick once before anyone kicks twice.
- Only players **on the field at the end of the match** (including extra time) may take kicks;
  only the designated goalkeepers on the field at the end may defend them.
- If one team has more players than the other at the end, it **reduces to equal numbers** and tells
  the referee who is excluded; the captain is responsible. Equal numbers are required only at the
  **start** of the kicks.
- If both teams are level after four kicks, kicks continue until one team has scored one more from
  the same number of kicks. If one team is already beyond the other's reach, no more kicks are
  taken.
- The kicker's goalkeeper teammate waits **outside the field along the touchline**.
- A goalkeeper injured or suffering complete technical failure during the kicks may be replaced by
  a named substitute, who then takes part in the kicks and defends all subsequent ones.
- If a player is injured or sent off during the kicks, the referee does **not** reduce the other
  team's number.

## Administrative notes (outline)

**Technical area** — lateral limits from the top of the goal area line to the halfway line, or 1 m
from the scorer's table, extending to the officials' area. Markings are recommended; occupancy is
set by competition rules and identified before the match; **only one person at a time** may convey
tactical instructions; team personnel enter the field only with a referee's permission (safety
excepted), asked via the nearest assistant referee or 4th official.

**Coaches** are responsible for all persons associated with their team and their conduct. **A coach
may also play**, but must be listed on the team sheet in both roles.

**The fourth official** may be appointed, officiates if one of the three match officials cannot
continue, assists at all times, handles administrative duties and substitution procedures,
supervises replacement balls, may check substitutes' equipment, must flag mistaken-identity
cautions and missed second cautions, reports misconduct out of the officials' view, and may inform
the referee of irresponsible behaviour in the technical area.

---

## Notes for app content

- Quote numbers **exactly** as written here (3 m · 30 cm · 5 m · 3.5 m · 8 × 5 m · 6 m · 1 m ·
  10 kph · 50.8 cm · 20 minutes · 10 minutes · 15 seconds · 5 seconds · 13 in). Do not round or
  paraphrase them.
- **The two-touch prohibition is stated in all seven restarts** — kick-off, direct free kick,
  indirect free kick, kick-in, goal kick, corner kick and penalty kick. The sanction is an indirect
  free kick to the opponents at the place of the infringement. A comparison table must not present
  it as a quirk of one restart.
  ⚠️ At a **penalty kick** the original writes *"(except with his hands)"*. That is **not an
  exemption**: a second touch by hand is deliberate handling, and Law 14 gives the opponents a
  **direct** free kick for it — a heavier sanction, not a lighter one. Both canonicals said
  "except with the hands" for a long time, which read as leniency. Corrected 2026-08-31.

- **Spelling.** The original is internally mixed (British *behaviour · colour · penalised ·
  manoeuvrability · centre*; American *offense · maneuver*). App English uses **British spelling for
  ordinary words** — that is where the original leans — and keeps **`offense`** for the defined
  rules term, because that is what the Laws' own section headings say (24 occurrences against 1).
  Law 11's called event is a **`violation`**, which is the original's word there (all 5 uses).
- **The set ball is also a restart** (Law 8 calls it "a way of restarting the match"). Counting
  "seven restarts" refers to the seven with the two-touch clause, not to the total.
- English app strings are derived from **this** file, never from `docs/RULES-FIPFA-2025.md`
  (that is a Korean summary of the same original — see the header).
- When FIPFA publishes a new edition, update this file first and the app content after — never the
  reverse.
