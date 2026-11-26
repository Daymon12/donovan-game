// Settings screen: change bullet speed and size, with a live preview bullet.
import { makeButton } from '../ui/button.js';
import { makeTextures } from '../art/textures.js';
import * as settings from '../settings.js';

const FONT = 'Arial Rounded MT Bold, Arial, sans-serif';

export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  create() {
    const { width, height } = this.scale;
    makeTextures(this);

    this.add.text(width / 2, height * 0.12, 'Settings', {
      fontFamily: FONT, fontSize: '72px', color: '#ffd84d', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.addStepper('bulletSpeed', height * 0.3);
    this.addStepper('bulletSize', height * 0.45);

    // --- Preview: a sample bullet flying up at the chosen speed and size ---
    this.previewTop = height * 0.56;
    this.previewBottom = height * 0.86;
    this.add.text(width / 2, this.previewTop - 10, 'Preview', {
      fontFamily: FONT, fontSize: '24px', color: '#8a90b8',
    }).setOrigin(0.5, 1);
    this.preview = this.add.image(width / 2, this.previewBottom, 'bullet-blue');

    makeButton(this, width / 2, height * 0.93, '◀ Back', () => {
      this.scene.start('TitleScene');
    }, { width: 220, height: 80, fontSize: 34, color: 0x5b6ee1 });
  }

  // One row: label, [-] current choice [+]
  addStepper(key, y) {
    const { width } = this.scale;

    this.add.text(width / 2, y - 60, settings.OPTIONS[key].label, {
      fontFamily: FONT, fontSize: '34px', color: '#ffffff',
    }).setOrigin(0.5);

    const value = this.add.text(width / 2, y + 10, settings.get(key).name, {
      fontFamily: FONT, fontSize: '44px', color: '#2ecc71', fontStyle: 'bold',
    }).setOrigin(0.5);

    const change = (delta) => value.setText(settings.step(key, delta).name);
    makeButton(this, width / 2 - 220, y + 10, '−', () => change(-1),
      { width: 100, height: 90, fontSize: 60, color: 0x3a4070 });
    makeButton(this, width / 2 + 220, y + 10, '+', () => change(+1),
      { width: 100, height: 90, fontSize: 60, color: 0x3a4070 });
  }

  update(time, delta) {
    // Move the preview bullet using the current settings, and loop it.
    this.preview.setScale(settings.get('bulletSize').value);
    this.preview.y -= settings.get('bulletSpeed').value * (delta / 1000);
    if (this.preview.y < this.previewTop) this.preview.y = this.previewBottom;
  }
}
