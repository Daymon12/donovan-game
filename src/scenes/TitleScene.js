// Start screen: title + one big START button.
import { makeButton } from '../ui/button.js';

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
  }
}
