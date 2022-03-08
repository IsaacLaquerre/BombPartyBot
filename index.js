const puppeteer = require("puppeteer");
const robot = require("robotjs");
const { keyboard, Key } = require("@nut-tree/nut-js");
const prompts = require("prompts");
const fs = require("fs");
const clear = require("clear-console");

keyboard.config.autoDelayMs = 0;

var words;
var username;

var wins = 0;
var losses = 0;

var typing = false;

var missingLetters = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v"];

fs.readFile("./words.txt", "utf8", (err, data) => {
    words = data.toLowerCase().split("\r\n");
    (async() => {
        const lobby = await prompts({
            type: "text",
            name: "value",
            message: "Lobby code:"
        });

        code = lobby.value;

        const user = await prompts({
            type: "text",
            name: "value",
            message: "Username:"
        });

        username = user.value;

        (async() => {
            const browser = await puppeteer.launch({
                headless: false,
                args: [
                    "--headless",
                    "--disable-web-security",
                    "--disable-features=IsolateOrigins,site-per-process"
                ]
            });
            const page = await browser.newPage();
            await page.goto("https://jklm.fun/" + code.toUpperCase(), { waitUntil: "networkidle0" });

            console.log("\x1b[32m√ \x1b[0mAccessed webpage");

            await page.evaluate(() => {
                document.querySelector(".nickname").value = "Guest" + Math.max(1000, Math.floor(Math.random() * 9999));
                document.querySelector(".nickname").nextElementSibling.click();
            }).then(async() => {
                console.log("\x1b[32m√ \x1b[0mEntered lobby \"" + code + "\"");

                page.waitForSelector("iframe").then(() => {
                    page.$("iframe").then(async(iframe) => {
                        const frame = await iframe.contentFrame();

                        console.log("\x1b[32m√ \x1b[0mBound to game board");

                        frame.waitForSelector(".player, .status").then(async() => {
                            console.log("\x1b[32m√ \x1b[0mLooking for player \"" + username + "\"...");

                            setInterval(async() => {
                                await frame.evaluate(() => {
                                    return {
                                        players: players,
                                        player: document.querySelector(".player").innerHTML,
                                        status: document.querySelector(".status").innerHTML,
                                        winner: document.querySelector(".winnerNickname").innerHTML
                                    }
                                }).then(data => {
                                    if (data.status.includes("Waiting for")) {
                                        if (data.winner != undefined && data.players.find(player => player.profile.nickname === username) === undefined) {
                                            if (data.winner === username) wins++;
                                            else losses++;

                                            console.log("\x1b[33m- \x1b[0mWins: \x1b[32m" + wins + "\x1b[0m, Losses: \x1b[31m" + losses + "\x1b[0m");

                                            robot.mouseClick();
                                        }

                                    }
                                    if (data.player === username) {
                                        if (!typing) newSyllable(frame, words);
                                    }
                                });
                            }, 1000);
                        });
                    });
                });
            });
        })();
    })();
});

async function newSyllable(frame, words) {

    // var response = await prompts({
    //     type: "text",
    //     name: "value",
    //     message: "Press enter to start next word search..."
    // });
    // enofgif (response.value != "" && (!response.value || response.value.toLowerCase() === "q" || response.value.toLowerCase() === "quit" || response.value.toLowerCase === "exit")) return process.exit();

    typing = true;

    findWord(frame, words).then((word) => {
        sleep(500).then(() => {
            keyboard.type(word).then(() => {
                keyboard.pressKey(Key.Enter).then(() => {
                    keyboard.releaseKey(Key.Enter).then(() => {
                        sleep(500).then(() => {
                            typing = false;
                        });
                    });
                });
            });
        });
    });
}

function findWord(frame, words) {
    return new Promise(async(resolve, reject) => {
        if (missingLetters.length === 0) missingLetters = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v"];

        frame.waitForSelector("div.syllable").then(async() => {
            await frame.evaluate("document.querySelector('div.syllable').innerText").then(syllable => {
                var bestWords = words.filter(word => word.includes(syllable.toLowerCase()) && missingLetters.some(char => { return word.includes(char); }));
                if (bestWords === undefined) bestWords = words.filter(word => word.includes(syllable.toLowerCase()));
                bestWords.sort(function(a, b) {
                    return b.length - a.length;
                });

                words.splice(words.indexOf(bestWords[0]), 1);

                missingLetters.some(char => {
                    if (bestWords[0].includes(char)) {
                        missingLetters.splice(missingLetters.indexOf(char), 1);
                    }
                });

                resolve(bestWords[0]);
            });
        });
    });
}

function sleep(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(() => { resolve() }, ms);
    });
}