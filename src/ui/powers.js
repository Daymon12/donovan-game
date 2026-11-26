// The 3 bullet powers, and the buttons each player taps to pick one.
//
//   ⚡ Electric - zaps an asteroid: it turns yellow and slows down for a while.
//   ❄ Freeze   - shatters a big asteroid into 4 small, light pieces.
//   🔥 Lava     - heats an asteroid red: it can't score until it cools down.

export const POWERS = {
  electric: { icon: '⚡', color: 0xffe14d },
  freeze:   { icon: '❄️', color: 0x9be7ff },
  lava:     { icon: '🔥', color: 0xff5a1f },
};

// A column of 3 buttons at x, centred on cy. flip = true turns them to face the top player.
export function makePowerButtons(scene, ship, x, cy, spacing, flip) {
  const w = 84;
  const h = spacing - 10;

  const items = Object.keys(POWERS).map((key, i) => {
    const y = cy + (i - 1) * spacing * (flip ? -1 : 1);
    const bg = scene.add.graphics();
    const icon = scene.add.text(0, 0, POWERS[key].icon, {
      fontSize: `${Math.min(40, h - 16)}px`,
    }).setOrigin(0.5);
    const box = scene.add.container(x, y, [bg, icon]).setAngle(flip ? 180 : 0).setDepth(5);

    const hit = scene.add.zone(x, y, w, h).setInteractive();
    hit.on('pointerdown', () => {
      ship.power = key;
      redraw();
      box.setScale(0.88);
      scene.time.delayedCall(90, () => box.setScale(1));
    });
    return { key, bg };
  });

  // The picked power is bright with a white border; the others are dim.
  function redraw() {
    for (const { key, bg } of items) {
      const on = ship.power === key;
      bg.clear();
      bg.fillStyle(on ? POWERS[key].color : 0x2a2f55, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
      if (on) {
        bg.lineStyle(4, 0xffffff, 1);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
      }
    }
  }
  redraw();
}
