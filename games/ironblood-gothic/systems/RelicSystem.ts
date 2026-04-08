import Phaser from 'phaser';

export class RelicSystem {
  private count: number = 0;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    // Icon is managed by the scene's display list; no reference needed
    scene.add
      .image(714, 22, 'relic')
      .setScrollFactor(0)
      .setScale(1.4)
      .setOrigin(0, 0.5)
      .setDepth(100);

    this.label = scene.add
      .text(732, 22, 'x 0', {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#c0c8d0',
      })
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(100);
  }

  add(amount: number): void {
    this.count += amount;
    this.label.setText(`x ${this.count}`);
  }

  spend(amount: number): boolean {
    if (this.count < amount) return false;
    this.count -= amount;
    this.label.setText(`x ${this.count}`);
    return true;
  }

  canAfford(amount: number): boolean {
    return this.count >= amount;
  }

  getCount(): number {
    return this.count;
  }
}
