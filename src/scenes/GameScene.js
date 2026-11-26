// The game screen. Placeholder for now; the real game goes here later.
import { makeButton } from '../ui/button.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;

    this.add.text(width / 2, height / 2, 'Game goes here', {
      fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
      fontSize: '56px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Small "back" button in the corner to return to the start screen.
    makeButton(this, 110, 70, '◀ Back', () => {
      this.scene.start('TitleScene');
    }, { width: 180, height: 80, fontSize: 34, color: 0x5b6ee1 });
  }
}
