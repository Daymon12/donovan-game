// A big, rounded, touch-friendly button that any scene can use.
// Usage: makeButton(this, x, y, 'START', () => { ... }, { width: 420, height: 160 })
export function makeButton(scene, x, y, label, onPress, opts = {}) {
  const width = opts.width ?? 420;
  const height = opts.height ?? 160;
  const color = opts.color ?? 0x2ecc71;
  const fontSize = opts.fontSize ?? 72;
  const radius = Math.min(40, height / 2);

  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.25);
  bg.fillRoundedRect(-width / 2, -height / 2 + 10, width, height, radius); // shadow
  bg.fillStyle(color, 1);
  bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);

  const text = scene.add.text(0, 0, label, {
    fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
    fontSize: `${fontSize}px`,
    color: '#ffffff',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  const button = scene.add.container(x, y, [bg, text]);

  // Invisible touch area on top that catches taps.
  const hit = scene.add.zone(x, y, width, height).setInteractive({ useHandCursor: true });

  hit.on('pointerdown', () => button.setScale(0.93));
  hit.on('pointerout', () => button.setScale(1));
  hit.on('pointerup', () => {
    button.setScale(1);
    onPress();
  });

  return button;
}
