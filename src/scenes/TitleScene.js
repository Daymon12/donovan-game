// Start screen: title + one big START button.
import { makeButton } from '../ui/button.js';
import { VERSION } from '../version.js';
import { checkForUpdate } from '../update.js';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const { width, height } = this.scale;

    this.add.text(width / 2, height * 0.22, "Donovan's Games", {
      fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
      fontSize: '80px',
      color: '#ffd84d',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const start = makeButton(this, width / 2, height * 0.58, 'START', () => {
      this.scene.start('GameScene');
    });

    // Gentle "breathing" so the button invites a tap.
    this.tweens.add({
      targets: start,
      scale: { from: 1, to: 1.06 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.addUpdateCorner(width, height);
  }

  // Grown-up corner: version number + small, low-key Update button.
  addUpdateCorner(width, height) {
    const small = { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#8a90b8' };

    this.add.text(width / 2, height - 24, `v${VERSION}`, small).setOrigin(0.5, 1);

    makeButton(this, 104, height - 52, 'Settings', () => {
      this.scene.start('SettingsScene');
    }, { width: 160, height: 56, fontSize: 24, color: 0x3a4070 });

    const status = this.add.text(width - 24, height - 110, '', small).setOrigin(1, 1);

    let busy = false;
    makeButton(this, width - 104, height - 52, '↻ Update', async () => {
      if (busy) return;
      busy = true;
      status.setText('Checking...');
      const result = await checkForUpdate();
      status.setText(result.message);
      if (!result.reloading) busy = false;
    }, { width: 160, height: 56, fontSize: 24, color: 0x3a4070 });
  }
}
