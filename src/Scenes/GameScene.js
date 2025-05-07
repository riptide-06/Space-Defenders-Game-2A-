export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0;
        this.health = 100;
        this.gameOver = false;
        this.currentWave = 1;
        this.enemiesKilled = 0;
        this.fightersSpawned = 0;
        this.starshipsSpawned = 0;
        this.banditsSpawned = 0;
        this.highScore = parseInt(localStorage.getItem('highScore')) || 0;
    }

    create() {
        this.screenWidth = this.sys.game.config.width;
        this.screenHeight = this.sys.game.config.height;

        // Create bounds for enemies
        this.enemyBounds = {
            top: 50,
            bottom: this.screenHeight * 0.7,
            left: 30,
            right: this.screenWidth - 30
        };

        this.player = this.physics.add.sprite(this.screenWidth / 2, this.screenHeight - 50, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.setScale(0.5);

        this.healthBar = this.add.rectangle(this.player.x, this.player.y + 30, 50, 5, 0x00ff00);
        this.healthBarBackground = this.add.rectangle(this.player.x, this.player.y + 30, 50, 5, 0xff0000);
        this.healthBarBackground.setDepth(0);
        this.healthBar.setDepth(1);

        this.enemies = this.physics.add.group();
        this.projectiles = this.physics.add.group();
        this.enemyProjectiles = this.physics.add.group();
        
        this.scoreText = this.add.text(16, 16, 'Score: 0', { 
            fontSize: '24px',
            fill: '#fff' 
        });
        
        this.highScoreText = this.add.text(16, 84, 'High Score: ' + this.highScore, {
            fontSize: '24px',
            fill: '#fff'
        });
        
        this.waveText = this.add.text(16, 50, 'Wave: 1', { 
            fontSize: '24px',
            fill: '#fff' 
        });

        this.cursors = this.input.keyboard.createCursorKeys();
        this.fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        this.physics.add.overlap(this.projectiles, this.enemies, this.hitEnemy, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.hitPlayer, null, this);
        this.physics.add.overlap(this.player, this.enemyProjectiles, this.hitPlayerWithProjectile, null, this);

        this.startWave1();
    }

    update() {
        if (this.gameOver) {
            if (this.fireKey.isDown) {
                this.scene.restart();
                this.score = 0;
                this.health = 100;
                this.gameOver = false;
                this.currentWave = 1;
                this.enemiesKilled = 0;
            }
            return;
        }

        this.healthBarBackground.setPosition(this.player.x, this.player.y + 30);
        this.healthBar.setPosition(this.player.x, this.player.y + 30);
        this.healthBar.width = (this.health / 100) * 50;

        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-300);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(300);
        } else {
            this.player.setVelocityX(0);
        }

        if (Phaser.Input.Keyboard.JustDown(this.fireKey)) {
            this.fire();
        }
        
        this.player.setVelocityY(0);
        this.player.y = this.screenHeight - 50;

        this.updateProjectiles();
        this.updateEnemies();
        this.checkWaveCompletion();
    }

    updateProjectiles() {
        this.projectiles.getChildren().forEach(projectile => {
            if (projectile.y < 0) projectile.destroy();
        });
    }

    updateEnemies() {
        this.enemies.getChildren().forEach(enemy => {
            // Only apply bounds to non-civilian ships
            if (enemy.enemyType !== 'civilian') {
                if (enemy.x < this.enemyBounds.left) {
                    enemy.x = this.enemyBounds.left;
                    if (enemy.body.velocity.x < 0) enemy.body.velocity.x *= -1;
                }
                if (enemy.x > this.enemyBounds.right) {
                    enemy.x = this.enemyBounds.right;
                    if (enemy.body.velocity.x > 0) enemy.body.velocity.x *= -1;
                }
                if (enemy.y < this.enemyBounds.top) {
                    enemy.y = this.enemyBounds.top;
                    if (enemy.body.velocity.y < 0) enemy.body.velocity.y *= -1;
                }
                if (enemy.y > this.enemyBounds.bottom) {
                    enemy.y = this.enemyBounds.bottom;
                    if (enemy.body.velocity.y > 0) enemy.body.velocity.y *= -1;
                }
            }

            if (enemy.y >= this.screenHeight * 0.3 && enemy.enemyType !== 'civilian') {
                enemy.setVelocityY(-25);
            }

            if (enemy.enemyType !== 'civilian') {
                if (enemy.fireTimer === undefined) {
                    enemy.fireTimer = this.time.now + Phaser.Math.Between(800, 2000);
                }
                
                if (this.time.now > enemy.fireTimer) {
                    this.enemyFire(enemy);
                    enemy.fireTimer = this.time.now + Phaser.Math.Between(800, 2000);
                }
            } else {
                enemy.setVelocityY(120);
            }

            if (enemy.enemyType === 'fighter') {
                this.updateFighterMovement(enemy);
            } else if (enemy.enemyType === 'starship') {
                this.updateStarshipMovement(enemy);
            } else if (enemy.enemyType === 'bandit') {
                this.updateBanditMovement(enemy);
            } else if (enemy.enemyType === 'frigate') {
                this.updateFrigateMovement(enemy);
            }

            // Only destroy civilians if they go below the screen
            if (enemy.enemyType === 'civilian' && enemy.y > this.screenHeight) {
                enemy.destroy();
            }
        });
    }

    startWave1() {
        this.spawnFighters(4);
        this.spawnCivilians(3);
    }

    startWave2() {
        this.currentWave = 2;
        this.waveText.setText('Wave: 2');
        this.spawnStarships(3);
        this.spawnCivilians(4);
    }

    startWave3() {
        this.currentWave = 3;
        this.waveText.setText('Wave: 3');
        this.spawnBandits(4);
        this.spawnCivilians(5);
    }

    startBossFight() {
        this.currentWave = 4;
        this.waveText.setText('BOSS WAVE');
        this.spawnFrigate();
        this.spawnCivilians(6);
    }

    spawnFrigate() {
        const frigate = this.enemies.create(this.screenWidth / 2, 100, 'frigate');
        frigate.enemyType = 'frigate';
        frigate.health = 500;
        frigate.setScale(0.8);
        frigate.setVelocityX(50);
        frigate.originalY = frigate.y;
    }

    updateFrigateMovement(frigate) {
        if (frigate.x >= this.enemyBounds.right) {
            frigate.setVelocityX(-50);
        } else if (frigate.x <= this.enemyBounds.left) {
            frigate.setVelocityX(50);
        }

        frigate.y = frigate.originalY + Math.sin(this.time.now / 1000) * 20;

        if (!frigate.lastFired || this.time.now > frigate.lastFired + 600) {
            this.enemyFire(frigate);
            frigate.lastFired = this.time.now;
        }
    }

    spawnFighters(count) {
        const spacing = (this.enemyBounds.right - this.enemyBounds.left) / (count + 1);
        for (let i = 0; i < count; i++) {
            const x = this.enemyBounds.left + spacing * (i + 1);
            const enemy = this.enemies.create(x, this.enemyBounds.top, 'fighter');
            enemy.enemyType = 'fighter';
            enemy.health = 35;
            enemy.setVelocityY(25);
            enemy.originalX = x;
            enemy.setScale(0.5);
            this.fightersSpawned++;
        }
    }

    spawnStarships(count) {
        const spacing = (this.enemyBounds.right - this.enemyBounds.left) / (count + 1);
        for (let i = 0; i < count; i++) {
            const x = this.enemyBounds.left + spacing * (i + 1);
            const enemy = this.enemies.create(x, this.enemyBounds.top, 'starship');
            enemy.enemyType = 'starship';
            enemy.health = 140;
            enemy.setVelocityY(20);
            enemy.setScale(0.5);
            this.starshipsSpawned++;
        }
    }

    spawnBandits(count) {
        const spacing = (this.enemyBounds.right - this.enemyBounds.left) / (count + 1);
        for (let i = 0; i < count; i++) {
            const x = this.enemyBounds.left + spacing * (i + 1);
            const enemy = this.enemies.create(x, this.enemyBounds.top, 'bandit');
            enemy.enemyType = 'bandit';
            enemy.health = 105;
            enemy.setVelocityY(30);
            enemy.setScale(0.5);
            this.banditsSpawned++;
        }
    }

    spawnCivilians(count) {
        const spacing = this.screenWidth / (count + 1);
        for (let i = 0; i < count; i++) {
            const x = spacing * (i + 1);
            const enemy = this.enemies.create(x, 50, 'civilian');
            enemy.enemyType = 'civilian';
            enemy.setVelocityY(120);
            enemy.setScale(0.5);
        }
    }

    updateFighterMovement(fighter) {
        if (!fighter.pattern) {
            fighter.pattern = 'sine';
            fighter.patternOffset = Phaser.Math.Between(0, 200);
        }
        
        if (fighter.y >= this.enemyBounds.top && fighter.y <= this.enemyBounds.bottom) {
            const newX = fighter.originalX + Math.sin((fighter.y + fighter.patternOffset) / 40) * 120;
            fighter.x = Phaser.Math.Clamp(newX, this.enemyBounds.left, this.enemyBounds.right);
        }
    }

    updateStarshipMovement(starship) {
        if (!starship.nextDirectionChange) {
            starship.nextDirectionChange = this.time.now + 1500;
        }
        
        if (this.time.now > starship.nextDirectionChange) {
            starship.setVelocityX(Phaser.Math.Between(-50, 50));
            starship.nextDirectionChange = this.time.now + 1500;
        }
    }

    updateBanditMovement(bandit) {
        if (!bandit.nextMove) {
            bandit.nextMove = this.time.now + 800;
        }
        
        if (this.time.now > bandit.nextMove) {
            bandit.setVelocity(
                Phaser.Math.Between(-60, 60),
                Phaser.Math.Between(-25, 50)
            );
            bandit.nextMove = this.time.now + 800;
        }
    }

    fire() {
        const projectile = this.projectiles.create(this.player.x, this.player.y - 20, 'laser_red');
        projectile.setVelocityY(-400);
        projectile.setScale(0.5);
    }

    enemyFire(enemy) {
        const projectile = this.enemyProjectiles.create(enemy.x, enemy.y + 20, 'laser_blue');
        projectile.setVelocityY(200);
        projectile.setScale(0.5);
    }

    updateHighScore() {
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('highScore', this.highScore.toString());
            this.highScoreText.setText('High Score: ' + this.highScore);
        }
    }

    hitEnemy(projectile, enemy) {
        projectile.destroy();
        
        if (enemy.enemyType === 'civilian') {
            enemy.destroy();
            this.score -= 25;
            this.scoreText.setText('Score: ' + this.score);
            return;
        }

        if (enemy.enemyType === 'fighter') {
            enemy.destroy();
            this.enemiesKilled++;
            this.score += 10;
        } else {
            enemy.health -= 35;
            if (enemy.health <= 0) {
                enemy.destroy();
                this.enemiesKilled++;
                switch (enemy.enemyType) {
                    case 'starship':
                        this.score += 25;
                        break;
                    case 'bandit':
                        this.score += 30;
                        break;
                    case 'frigate':
                        this.score += 100;
                        this.gameOver = true;
                        this.updateHighScore();
                        this.add.text(this.screenWidth / 2, this.screenHeight / 2, 
                            'Mission Complete!\nScore: ' + this.score + '\nHigh Score: ' + this.highScore + '\nPress SPACE to play again', {
                            fontSize: '32px',
                            fill: '#fff',
                            align: 'center'
                        }).setOrigin(0.5);
                        break;
                }
            }
        }
        
        this.scoreText.setText('Score: ' + this.score);
    }

    hitPlayer(player, enemy) {
        if (enemy.enemyType === 'civilian') {
            enemy.destroy();
            this.health -= 15;
            this.score -= 25;
            this.scoreText.setText('Score: ' + this.score);
        } else {
            switch (enemy.enemyType) {
                case 'fighter':
                    this.health -= 10;
                    break;
                case 'starship':
                    this.health -= 20;
                    break;
                case 'bandit':
                    this.health -= 25;
                    break;
                case 'frigate':
                    this.health -= 40;
                    break;
            }
            enemy.destroy();
        }
        
        if (this.health <= 0) {
            this.gameOver = true;
            this.updateHighScore();
            this.add.text(this.screenWidth / 2, this.screenHeight / 2, 
                'Game Over\nScore: ' + this.score + '\nHigh Score: ' + this.highScore + '\nPress SPACE to restart', {
                fontSize: '32px',
                fill: '#fff',
                align: 'center'
            }).setOrigin(0.5);
        }
    }

    hitPlayerWithProjectile(player, projectile) {
        projectile.destroy();
        this.health -= 10;
        
        if (this.health <= 0) {
            this.gameOver = true;
            this.updateHighScore();
            this.add.text(this.screenWidth / 2, this.screenHeight / 2, 
                'Game Over\nScore: ' + this.score + '\nHigh Score: ' + this.highScore + '\nPress SPACE to restart', {
                fontSize: '32px',
                fill: '#fff',
                align: 'center'
            }).setOrigin(0.5);
        }
    }

    checkWaveCompletion() {
        if (this.gameOver) return;

        switch (this.currentWave) {
            case 1:
                if (this.enemies.countActive() === 0 && this.fightersSpawned < 8) {
                    this.spawnFighters(4);
                    this.spawnCivilians(3);
                } else if (this.enemies.countActive() === 0 && this.fightersSpawned >= 8) {
                    this.startWave2();
                }
                break;
                
            case 2:
                if (this.enemies.countActive() === 0) {
                    if (this.starshipsSpawned < 9) {
                        this.spawnStarships(3);
                        this.spawnCivilians(4);
                    } else {
                        this.startWave3();
                    }
                }
                break;
                
            case 3:
                if (this.enemies.countActive() === 0 && this.banditsSpawned >= 4) {
                    this.startBossFight();
                }
                break;
        }
    }
}
