# Walking guidance update

Checked 22 October 2026.

Outdoor source instructions now follow approximate GPS progress. Indoor sections,
explicit floor/bridge cues and vertical connectors stop automatic advancement for
a signs or level check. Walking accepts a matched-floor confirmation directly in
the instruction card; the expanded guide retains floor-plan confirmation.

The instruction card sits at the top of the map. Camera insets account for its
height on mobile. Walked sections use a muted dotted material, including when
shown through 3D buildings. The last accepted walked distance survives GPS loss
and resets for a replacement route. Indoor exit badges render above amenity
markers, with an opaque background, white halo and no truncated exit code.

Automatic rerouting requires three distinct off-route fixes over at least eight
seconds, with reported accuracy at most 25 m. An uncertain or on-route fix resets
the window. Requests are at least 30 seconds apart, and pending indoor/level
checks suppress automatic rerouting. Manual retry remains available.

## Evidence

- Type checking, lint, the full 90-file / 352-test suite and production build
  passed. Lint retains an existing unnecessary-dependency warning in
  `StationFloorPlan.tsx`; existing React `act` warnings also remain in the building
  route test.
- A subsequent renderer regression test passed with all four tests in
  `WalkingRouteLayer.test.ts`. It checks dotted versus solid material on visible
  and depth-fail geometry and verifies that GPS progress does not reframe the
  camera.
- Added regression coverage for automatic outdoor progression, connector and
  bridge checks, manual fallback, level cues in English and Chinese, distinct
  rerouting samples, drift recovery, retry throttling, walked-distance retention
  and geometry splitting without joining disconnected source paths.
- Browser screenshots and interaction checks could not run: the sandbox denied
  the dev server's listen socket and Chromium's startup socket. Phone/desktop
  layout, physical Android performance and the Kai Tak–Inland Revenue Department
  journey therefore remain unverified.

GPS progress uses XY geometry and source step distances; it cannot distinguish a
bridge from the street beneath it, identify an indoor floor, or prove that a lift
is operating. Level labels describe the source instruction, not a measured user
floor. No live journey or source availability claim follows from these tests.
