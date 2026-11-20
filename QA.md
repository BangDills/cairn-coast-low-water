# Cairn Coast verification

This document records local development evidence. It is not an official make.fun grade, a transcript-gate certification, or a claim of placement. No entry has been submitted or published by this worker.

## Environment

- Runtime available for the exact artifact: Node v22.23.4 at `/opt/node22/bin/node`.
- Browser: installed Chromium 1248, 1280 × 720 desktop viewport, device scale 1, headless SwiftShader software renderer. No accelerated desktop performance measurement is available.
- Browser tests abort requests to every hostname except their own `127.0.0.1` static server. The game uses no runtime external assets or services.
- Test scripts use real keyboard and mouse input. `window.cairn.snapshot()` returns read-only state and projected positions for assertions and aiming; it exposes no gameplay setters. Domain tests separately inject controlled state and are not presented as browser playthroughs.
- Development logs and raw captures are under ignored `.qa/`; research files are under ignored `research/`. Original Codex recording files are not edited or rewritten.

## Verified checks

`/opt/node22/bin/node tests/systems.mjs`: 22 passing domain checks. These cover seeded input, building line of sight, street routing, clear convoy geometry, forward convoy departure, distinct vehicle speeds and measured upgrades, chassis protection in real vehicle collisions, collision mass, save validation including zero coordinates, all five mission state machines and rewards, failure/retry, archive cutoff and engine bypass, tiers 1/3/5 dispatch and hidden cooldown, patrol viewing direction and close-following braking, officer proximity for arrest, one-time purchases, health/armor/ammunition/weapon inventory and unseen plates, armor/defeat, cargo bullet resistance, and race rewards/best time.

Measured straight-line top speeds: coupe 48 m/s, sedan 36 m/s, van 29 m/s, tuned sedan 43.2 m/s. Road tires increased the tested steering response by 18%; reinforced chassis reduced the tested wall-impact damage. These are simulation measurements, not real-world performance claims.

`node tests/menus.mjs`: passed. The test visited the controls at 390 × 844 without horizontal overflow, returned through start/pause/controls/map/briefing, canceled new-game confirmation, retried and abandoned a job, changed graphics/sound/reduced motion, saved, and checked a 1024 × 768 HUD. It then fired in the city, observed saving blocked while wanted, waited for an actual **Busted** state, confirmed Escape and M could not bypass recovery, recovered at the clinic, walked to Room 9, and rested/saved. No page/console errors or non-loopback requests occurred.

The first story job, its garage payment, purchase of Road tires, and reload/Continue persistence were exercised through keyboard and mouse. The marked-van job subsequently passed its theft, tier-two pursuit, escape and garage payment. The port job passed two guards fired on from the car and the last on foot, manifest collection, taking a fresh escape vehicle, a tier-three pursuit, escape and Inez's payment. The timed relay job passed all three uploads while strafing inside the rings, a fresh-car getaway, escape before the deadline and its payment. Later results and final artifact checks are recorded below. These runs use earned browser saves across chapters; they are not claimed as one uninterrupted playthrough.

`node tests/theft.mjs`: passed. The player walked to a junction, waited for an occupied traffic car to slow, took it with E, triggered a wanted response, stopped it with the handbrake, and exited on foot. No page/console errors or non-loopback requests occurred.

## Revisions driven by testing

- Initial software rendering was too expensive. Rigid geometry is now merged and static city geometry is tiled; window facades use locally generated textures, shadows update after movement, and Automatic quality can select the lower-resolution Performance mode.
- Direct screenshots showed floating-looking vehicles in Performance mode. One shared instanced contact-shadow pass now grounds nearby cars and people.
- An early police test incorrectly attributed police-initiated contact to player ramming. Crime escalation now requires the player's faster, directed impact. Lower-tier police brake when closing on a slow vehicle; tiers one and two have lower pursuit speeds than high-tier interceptors. Distant visual detection uses a forward view and all detection still requires an unblocked sightline.
- Some early browser pursuit tests failed: a test driver reversed along entire road segments; later driving could overshoot turns; long pursuits destroyed the mission van or timed out before escape. The driver now uses short reversals and the handbrake at tight turns. These failed runs are not counted as successful missions. One run escaped but lost its browser connection before the handover; that run is incomplete.
- Port geometry review found a container stack blocking Dock Road and the archive convoy spawn. The stack was moved out of the lane; a regression checks the full lane and manifest position.
- Number-key weapon switching now cancels a pending reload. Recovery screens reject pause/map shortcuts. Tall narrow-screen menus scroll from an accessible top edge.
- A close patrol car could previously trigger arrest without an officer reaching the player. Capture now requires a living officer within reach and clear sight; officers approach on foot. A regression covers both an empty nearby patrol and an officer in reach.
- Pursuit tests showed the chassis purchase only protected against walls. It now reduces vehicle collision damage by the same measured 41%, and its shop description states both effects.
- Failed port attempts include being arrested while stationary, being wounded after fighting entirely on foot, and losing an already damaged getaway car. A successful attempt used vehicle cover and took a fresh escape vehicle. These failures are retained in development evidence and are not counted as completions.
- Relay tests exposed a test-driver walking dead zone and an arrest during a stationary upload. The driver now uses a tolerance appropriate to vehicle entry; the real game prompt clarifies that the player may move inside the relay ring while holding F.
- Visual review prompted actual loading-bay paint and concrete seams in the port, plus a higher camera sightline and useful vertical orbit. Screenshots remain direct browser captures.
- Firing from a moving car now holds the camera orbit instead of automatically pulling the target out of frame. Dialogue moved below the mission panel to leave the driven vehicle visible.
- The convoy initially tried to return to a junction behind its spawn and struck cargo. Traffic now discards that backward first waypoint. The archive cutoff gives the player a short reaction interval to release automatic fire; the announced crew bypass restores the damaged engine before the getaway. Nearby marked steal objectives take entry priority over a patrol crowding the truck.
- Several archive attempts failed: a slow turn to approach from behind exposed the coupe before boarding; tight-turn escape routes trapped the test driver; repeated contact destroyed the truck. These failures are retained, not counted as successful missions. Tests also exercised defensive fire. The successful route met the moving truck from ahead, then used long inland streets.
- Cargo armor now absorbs more patrol fire than a regular car. Collision damage is shared by the vehicles' mass, so the heavy truck takes less damage than the light vehicle it hits. Both behaviors have domain regressions.
- Save validation now preserves coordinates equal to zero instead of substituting the starting location.

## Campaign completion

`SKIP_COVER=1 node tests/finale.mjs`: passed from the earned chapter-four checkpoint. The player intercepted the moving archive from ahead, disabled it with SMG fire, boarded it, escaped a five-tier cordon/air search, delivered the truck, met Inez on foot, received the $4,000 reward and completed chapter five. The final snapshot records five paid jobs, four escaped pursuits, $7,110, and all four purchased upgrades. Health and armor were both 100 at the final handover. There were no page/console errors or non-loopback requests.

The successful escape used the long inland street and North Loop, with no defensive fire or back-lane hiding required. Earlier perimeter attempts remained visible and failed; one failed attempt produced the selected cover. The cover is a direct frame from that real five-tier archive pursuit, not evidence that that particular attempt completed. Separating the capture from the completion run avoided leaving driving input unchanged during a slow software-renderer screenshot.

`node tests/activities.mjs`: passed through real controls. A four-checkpoint race paid $400, then all three delivery stops paid $150 each plus the $300 completion bonus. Activity counts rose from two to three to four in this repeat run; the earlier earned run had already completed both once. The final earned save contains $9,410 and a 55.08-second best sprint. Rest/save, reload/Continue, the complete journal, SMG automatic fire and switching weapons during reload all passed without browser errors or non-loopback requests.

An earlier Shadows-mode race destroyed the car after repeated automated steering errors. A later Performance-mode run completed both activities but failed a screenshot-only guard because its camera condition was too restrictive. The final repeat used Performance for driving and paused for quality changes around a short direct capture. Neither earlier failure is counted as a clean test pass.

## Performance and remaining scope

The initial SwiftShader median was about 817 ms per frame. After optimization, development samples were around 50–67 ms median, with p95 varying by startup, scene, and concurrent testing. The supplied design brief's 33 ms p95 target was **not met** on this software renderer. Final hardware-accelerated performance remains unmeasured. Performance mode trades resolution and map shadows for responsiveness; original contact shadows remain.

The brief's ten repeated seeded end-to-end loops and three routes at each of three wanted tiers are targets, not completed certification. There is no official local grader for this competition. The kit check skips sealed-recording and server-only checks; the coordinator must preserve and seal the actual recording, prepare truthful parent-chat metadata, refresh quota, and decide whether to submit.

The three README badge images are live make.fun endpoints for the intended repository name. This handoff uses an unpublished source bundle; there is no published GitHub repository or verified badge rank/reward. The coordinator should keep that distinction if choosing a later repository route.
