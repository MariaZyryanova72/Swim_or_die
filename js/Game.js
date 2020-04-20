(function() {
    var GameInitialize = function GameInitialize() {

        var DEBUG_MODE = false,

            GAME_SPEED = 180,
            GRAVITY = 1300,
            AKULA_SWIM = 400,

            PIPE_SPAWN_MIN_INTERVAL = 1200,
            PIPE_SPAWN_MAX_INTERVAL = 3000,
            AVAILABLE_SPACE_BETWEEN_PIPES = 130,

            MAX_DIFFICULT = 100,

            SCENE = 'game',

            TITLE_TEXT = "SWIM OR DIE",


            LOADING_TEXT = "ЗАГРУЗКА...",
            CANVAS_WIDTH = window.innerWidth || document.documentElement.clientWidth || document.getElementsByTagName('body')[0].clientWidth,
            CANVAS_HEIGHT = window.innerHeight || document.documentElement.clientHeight || document.getElementsByTagName('body')[0].clientHeight;



        var Background,
            Pipes, PipesTimer, FreeSpacesInPipes,
            Akula,
            Domaschka,
            SwimSound, ScoreSound, DieSound,
            SoundEnabledIcon, SoundDisabledIcon,
            TitleText, ScoreText, HighScoreTitleText, HighScoreText, PostScoreText, LoadingText,
            PostScoreClickArea,
            isScorePosted = false,
            isSoundEnabled = true,
            Leaderboard;

        var gameScore = 0;
        var BootGameState = new Phaser.State();

        BootGameState.create = function() {
            LoadingText = Game.add.text(Game.world.width / 2, Game.world.height / 2, LOADING_TEXT, {
                font: '32px "Press Start 2P"',
                fill: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'center'
            });
            LoadingText.anchor.setTo(0.5, 0.5);

            Game.state.start('Preloader', false, false);
        };

        var PreloaderGameState = new Phaser.State();

        PreloaderGameState.preload = function() {
            loadAssets();
        };

        PreloaderGameState.create = function() {
            var tween = Game.add.tween(LoadingText).to({
                alpha: 0
            }, 1000, Phaser.Easing.Linear.None, true);

            tween.onComplete.add(function() {
                Game.state.start('MainMenu', false, false);
            }, this);
        };

        var MainMenuState = new Phaser.State();

        MainMenuState.create = function() {
            function click() {
                if (Phaser.Rectangle.contains(SoundEnabledIcon.bounds, Game.input.x, Game.input.y)) {
                    toogleSound();
                } else {
                    akulaSwim();
                    Game.input.onDown.remove(click);
                    Game.state.start('Game', false, false);
                }
            }

            isScorePosted = false;

            createBackground();
            createDomaschka();
            createPipes(false);
            createAkula();
            createTexts();
            createSounds();

            gameScore = 0;

            Akula.angle = 0;
            Akula.reset(Game.world.width / 4, Game.world.height / 2);
            Akula.body.allowGravity = false;
            Akula.body.gravity.y = 0;
            Akula.animations.play('flying');

            TitleText.setText(TITLE_TEXT);
            ScoreText.setText("");
            HighScoreTitleText.setText("");
            HighScoreText.setText("");
            PostScoreText.setText("");

            Game.input.onDown.add(click);
        };

        MainMenuState.update = function() {
            Akula.y = (Game.world.height / 2) + 32 * Math.sin(Game.time.now / 200);
            Akula.x = (Game.world.width / 4) + 64 * Math.cos(Game.time.now / 500);

            Domaschka.tilePosition.x -= Game.time.physicsElapsed * GAME_SPEED / 5;
        };

        var GameState = new Phaser.State();

        GameState.create = function() {
            createPipes(true);

            TitleText.setText("");
            HighScoreTitleText.setText("");
            HighScoreText.setText("");
            PostScoreText.setText("");
            ScoreText.setText(gameScore);
            SoundEnabledIcon.renderable = false;
            SoundDisabledIcon.renderable = false;

            Akula.body.allowGravity = true;
            Akula.body.gravity.y = -GRAVITY;

            Game.input.onDown.add(akulaSwim);
        };

        GameState.update = function() {
            Akula.angle = (90 * (AKULA_SWIM + Akula.body.velocity.y) / AKULA_SWIM) - 180;
            if (Akula.angle < -10) {
                Akula.angle = 10;
            } else if (Akula.angle > 10) {
                Akula.angle = -10;
            }

            Game.physics.overlap(Akula, Pipes, function() {
                Game.state.start('GameOver', false, false);
            });

            if (Akula.body.bottom >= Game.world.bounds.bottom || Akula.body.top <= Game.world.bounds.top) {
                Game.state.start('GameOver', false, false);
            }

            Game.physics.overlap(Akula, FreeSpacesInPipes, addScore);

            Domaschka.tilePosition.x -= Game.time.physicsElapsed * getModifiedSpeed() / 5;
        };

        GameState.render = function() {
            if (DEBUG_MODE) {
                Game.debug.renderCameraInfo(Game.camera, 32, 32);
                Game.debug.renderSpriteBody(Akula);
                Game.debug.renderSpriteBounds(Akula);
                Game.debug.renderSpriteCorners(Akula, true, true);

                Game.debug.renderQuadTree(Game.physics.quadTree);

                Pipes.forEachAlive(function(pipe) {
                    Game.debug.renderSpriteBody(pipe);
                    Game.debug.renderSpriteCorners(pipe, true, true);
                });

                FreeSpacesInPipes.forEachAlive(function(spaceInPipe) {
                    Game.debug.renderSpriteBody(spaceInPipe);
                });
            }
        };

        var GameOverState = new Phaser.State();

        GameOverState.create = function() {
            getScore();

            Game.input.onDown.remove(akulaSwim);

            setTimeout(function() {
                Game.input.onDown.add(HighScoreStateClick);
            }, 1000);

            if (isSoundEnabled) {
                DieSound.play();
            }

            Pipes.forEachAlive(function(pipe) {
                pipe.body.velocity.x = 0;
            });

            FreeSpacesInPipes.forEachAlive(function(spaceInPipe) {
                spaceInPipe.body.velocity.x = 0;
            });

            PipesTimer.stop();

            TitleText.setText("");
            ScoreText.setText("ВАШ СЧЕТ: " + gameScore);
            HighScoreText.setText(LOADING_TEXT);

            SoundEnabledIcon.renderable = false;
            SoundDisabledIcon.renderable = false;

            Akula.angle = 180;
            Akula.animations.stop();
            Akula.frame = 3;
        };

        var akulaSwim = function akulaSwim() {
            Akula.body.velocity.y = AKULA_SWIM;
            if (isSoundEnabled) {
                SwimSound.play();
            }
        };

        var addScore = function addScore(_, spaceInPipe) {
            FreeSpacesInPipes.remove(spaceInPipe);
            ++gameScore;
            ScoreText.setText(gameScore);
            if (isSoundEnabled) {
                ScoreSound.play();
            }
        };

        var postScore = function postScore() {
            if (Leaderboard) {
                Leaderboard.post({
                    score: gameScore
                }, function() {
                    HighScoreText.setText(LOADING_TEXT);
                    getScore();
                });
            } else {
                HighScoreText.setText('Some error occured');
            }
        };

        var getScore = function getScore() {
            if (Leaderboard) {
                Leaderboard.fetch({
                    sort: 'desc',
                    best: true,
                    limit: 5
                }, function(results) {
                    if (Game.state.current == 'GameOver') {
                        var text = "";
                        for (var i in results) {
                            if (results.hasOwnProperty(i)) {
                                text += results[i].rank + '. ' + results[i].name + ' ' + results[i].score + '\n\n';
                            }
                        }
                        HighScoreText.setText(text);
                    }
                });
            } else {
                HighScoreText.setText('Some error occured');
            }
        };

        var HighScoreStateClick = function HighScoreStateClick() {
            if (Game.state.current == 'GameOver' && Phaser.Rectangle.contains(PostScoreClickArea, Game.input.x, Game.input.y) && !isScorePosted) {
                postScore();
                PostScoreText.setText("");
                isScorePosted = true;
            } else {
                Game.input.onDown.remove(HighScoreStateClick);
                Game.state.start('MainMenu', true, false);
            }
        };

        var getModifiedSpeed = function getModifiedSpeed() {
            return GAME_SPEED + gameScore * 5;
        };

        var toogleSound = function toogleSound() {
            if (isSoundEnabled) {
                SoundDisabledIcon.renderable = true;
                SoundEnabledIcon.renderable = false;
                isSoundEnabled = false;
            } else {
                SoundEnabledIcon.renderable = true;
                SoundDisabledIcon.renderable = false;
                isSoundEnabled = true;
                SwimSound.play();
            }
        };

        var loadAssets = function loadAssets() {
            Game.load.spritesheet('akula', 'img/akula.png', 89, 65);

            Game.load.image('Domaschka', 'img/background.png');
            Game.load.image('background', 'img/.png');
            Game.load.image('pipe', 'img/pipe1.png');
            Game.load.image('soundOn', 'img/soundOn.png');
            Game.load.image('soundOff', 'img/soundOff.png');

            Game.load.audio('swim', 'wav/swim.wav');
            Game.load.audio('die', 'wav/die.wav');
            Game.load.audio('score', 'wav/score.wav');
        };

        var createBackground = function createBackground() {
            Background = Game.add.graphics(0, 0);
            Background.beginFill(0x53BECE, 1);
            Background.drawRect(0, 0, Game.world.width, Game.world.height);
            Background.endFill();
        };


        var createDomaschka = function createDomaschka() {
            Domaschka = Game.add.tileSprite(0, 0,
                Game.world.width, Game.world.height, 'Domaschka');
        };

        var createAkula = function createAkula() {
            Akula = Game.add.sprite(0, 0, 'akula');
            Akula.anchor.setTo(0.5, 0.5);
            Akula.animations.add('flying', [0, 1, 2, 3, 2, 1, 0], 20, true);
            Akula.animations.play('flying');
            Akula.body.collideWorldBounds = true;
            Akula.body.gravity.y = 0;
            Akula.body.allowGravity = false;
        };

        var createPipes = function createPipes(timer) {
            function calcDifficult() {
                return AVAILABLE_SPACE_BETWEEN_PIPES +
                    (Math.floor(Math.random() * AVAILABLE_SPACE_BETWEEN_PIPES)) *
                    ((gameScore > MAX_DIFFICULT ? MAX_DIFFICULT : MAX_DIFFICULT - gameScore) / (MAX_DIFFICULT + 1));
            }

            function makeNewPipe(pipeY, isFlipped) {
                var pipe = Pipes.create(Game.world.width, pipeY +
                    (isFlipped ? -calcDifficult() : calcDifficult()) / 2, 'pipe');

                pipe.body.allowGravity = false;
                pipe.scale.setTo(2.5, isFlipped ? -2 : 2);
                pipe.body.offset.y = isFlipped ? -pipe.body.height * 2 : 0;
                pipe.body.velocity.x = -getModifiedSpeed();

                pipe.events.onOutOfBounds.add(function(pipe) {
                    pipe.kill();
                });

                return pipe;
            }

            function makePipes() {
                var pipeY = ((Game.world.height - 16 - calcDifficult() / 2) / 2) + (Math.random() > 0.5 ? -1 : 1) * Math.random() * Game.world.height / 5,
                    bottomPipe = makeNewPipe(pipeY),
                    topPipe = makeNewPipe(pipeY, true),
                    spaceInPipe = FreeSpacesInPipes.create(topPipe.x + topPipe.width, 0);

                spaceInPipe.width = 2;
                spaceInPipe.height = Game.world.height;
                spaceInPipe.body.allowGravity = false;
                spaceInPipe.body.velocity.x = -getModifiedSpeed();

                var newTime = Game.rnd.integerInRange(PIPE_SPAWN_MIN_INTERVAL, PIPE_SPAWN_MAX_INTERVAL) - getModifiedSpeed() * 2;
                PipesTimer.add(newTime < PIPE_SPAWN_MIN_INTERVAL ? PIPE_SPAWN_MIN_INTERVAL : newTime, makePipes, this);
            }

            if (timer) {
                PipesTimer = Game.time.create(false);
                PipesTimer.add(0, makePipes, this);
                PipesTimer.start();
            } else {
                Pipes = Game.add.group();
                FreeSpacesInPipes = Game.add.group();
            }
        };

        var createTexts = function createTexts() {
            TitleText = Game.add.text(Game.world.width / 2, Game.world.height / 3, TITLE_TEXT, {
                font: '32px "Press Start 2P"',
                fill: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'center'
            });
            TitleText.anchor.setTo(0.5, 0.5);

            ScoreText = Game.add.text(Game.world.width / 2, Game.world.height / 6, "", {
                font: '24px "Press Start 2P"',
                fill: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'center'
            });
            ScoreText.anchor.setTo(0.5, 0.5);

            HighScoreTitleText = Game.add.text(Game.world.width / 2, Game.world.height / 10, "", {
                font: '28px "Press Start 2P"',
                fill: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'center'
            });
            HighScoreTitleText.anchor.setTo(0.5, 0.5);

            HighScoreText = Game.add.text(Game.world.width / 2, Game.world.height / 2, "", {
                font: '16px "Press Start 2P"',
                fill: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 2,
                align: 'center'
            });
            HighScoreText.anchor.setTo(0.5, 0.5);

            PostScoreText = Game.add.text(Game.world.width / 2, Game.world.height - Game.world.height / 4, "", {
                font: '16px "Press Start 2P"',
                fill: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 2,
                align: 'center'
            });
            PostScoreText.anchor.setTo(0.5, 0.5);
            PostScoreClickArea = new Phaser.Rectangle(PostScoreText.x - PostScoreText.width * 5, PostScoreText.y - PostScoreText.height, PostScoreText.width + 200, PostScoreText.height * 4);
        };

        var createSounds = function createSounds() {
            SoundEnabledIcon = Game.add.sprite(10, 10, 'soundOn');
            SoundEnabledIcon.renderable = isSoundEnabled ? true : false;

            SoundDisabledIcon = Game.add.sprite(10, 10, 'soundOff');
            SoundDisabledIcon.renderable = isSoundEnabled ? false : true;

            SwimSound = Game.add.audio('swim');
            ScoreSound = Game.add.audio('score');
            DieSound = Game.add.audio('die');
        };

        var Game = new Phaser.Game(CANVAS_WIDTH, CANVAS_HEIGHT, Phaser.CANVAS, SCENE, null, false, false);

        Game.state.add('Boot', BootGameState, false);
        Game.state.add('Preloader', PreloaderGameState, false);
        Game.state.add('MainMenu', MainMenuState, false);
        Game.state.add('Game', GameState, false);
        Game.state.add('GameOver', GameOverState, false);

        Game.state.start('Boot');

        Clay.ready(function() {
            Leaderboard = new Clay.Leaderboard({
                id: 2835
            });
        });
    };

    WebFont.load({
        google: {
            families: ['Press+Start+2P']
        },
        active: function() {
            GameInitialize();
        }
    });
})();
