import puppeteer from "puppeteer";
import prompts from "prompts";
import dash from "dashargs";
import fs from "fs";

const stdin = process.openStdin();
process.stdin.setEncoding("utf-8");

var args = dash.parse(process.argv.join(" "));

var wordBank;
var username = args.username || "Bot" + Math.floor(Math.random() * 10) + Math.floor(Math.random() * 10) + Math.floor(Math.random() * 10) + Math.floor(Math.random() * 10);

var typing = false;
var skip = false;
var myTurn = false;

var missingLetters = [];

fs.readFile("./words.txt", "utf8", (err, data) => {
    wordBank = data.toLowerCase().split("\r\n");
    (async() => {

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

            await page.exposeFunction("newChat", newChat);

            stdin.addListener("data", inputStdin => {
                process.stdout.moveCursor(0, -1);
                process.stdout.clearLine(1);
                var input = inputStdin.toString().trim();

                chat(page, input);
            });

            if (args.code != undefined) var code = args.code;
            else {
                const lobby = await prompts({
                    type: "text",
                    name: "value",
                    message: "Lobby code:"
                });

                var code = lobby.value;
            }

            page.on("error", (err) => {
                console.log(err);
                process.exit();
            });

            page.on("framedetached", () => {
                console.log("Lost bind to frame. Killing process...");
                process.exit();
            });

            process.on("unhandledRejection", (err) => {
                console.log(err);
                process.exit();
            });

            process.on("uncaughtException", (err) => {
                console.log(err);
                process.exit();
            });

            findGame(page, code);
        })();
    })();
});

async function findGame(page, code) {
    await page.goto("https://jklm.fun/" + code.toUpperCase(), { waitUntil: "networkidle0" });

    try {
        await page.evaluate((username) => {
            document.querySelector(".nickname").value = username;
            document.querySelector(".nickname").nextElementSibling.click();
        }, username).then(async() => {
            console.log("\x1b[32m√ \x1b[0mEntered lobby \"" + code + "\"");


            page.waitForSelector("button.sidebarToggle", { visible: true }).then(async() => {
                await page.evaluate("document.querySelector('button.sidebarToggle').innerHTML").then(async value => {
                    if (value === "◀") {
                        await page.evaluate(function() {
                            document.querySelector('button.sidebarToggle').click();
                        }).then(() => {
                            sleep(1000).then(() => {
                                readChat(page);
                                getFrame(page);
                            });
                        });
                    }
                });
            });
        });
    } catch {
        console.error(new Error("Couldn't find lobby with code \"" + code + "\""));
    }
}

async function joinGame(frame) {
    getStatus(frame).then(async status => {
        if (status != "idle") {
            sleep(2500).then(() => {
                return joinGame(frame);
            });
        } else {
            await frame.waitForSelector(".joinRound").then(async() => {
                frame.evaluate("document.querySelector('.joinRound').click()").then(() => {
                    var words = wordBank;

                    checkTurn(frame, words, undefined);
                });
            });

        }
    });
}

async function checkTurn(frame, words, lastTurn) {

    await frame.evaluate(() => {
        return {
            players: players,
            player: document.querySelector(".player").innerHTML,
            winner: document.querySelector(".winnerNickname").innerHTML
        };
    }).then(data => {
        getStatus(frame).then(async status => {
            if (status === "idle") {
                if (data.winner != undefined && data.players.find(player => player.profile.nickname === username) === undefined) {

                    joinGame(frame);
                }

            } else {
                if (data.player === username) {
                    myTurn = true;
                } else {
                    myTurn = false;
                    skip = false;
                }

                var newTurn = false;

                if (data.player != lastTurn) newTurn = true;

                if (data.players.find(player => player.profile.nickname === username) != undefined) {
                    await frame.evaluate("milestone").then(milestone => {
                        if (missingLetters.length === 0) missingLetters = milestone.dictionaryManifest.bonusAlphabet.split("");
                    });
                }
                if (myTurn) {
                    if (!typing && !skip) newSyllable(frame, words);
                }
            }

            lastTurn = data.player;

            sleep(250).then(() => {
                checkTurn(frame, words, lastTurn);
            });

        });
    });
}

function getStatus(frame) {
    return new Promise(async(resolve, reject) => {
        await frame.evaluate(() => {
            return document.querySelector(".status").innerHTML;
        }).then(status => {
            resolve(status.includes("Waiting for") ? "idle" : "ongoing");
        });
    });
}

async function getFrame(page) {
    page.waitForSelector(".game > iframe", { visible: true }).then(() => {
        page.$(".game > iframe").then(async(iframe) => {
            const frame = await iframe.contentFrame();

            console.log("\x1b[32m√ \x1b[0mBound to game board");

            frame.waitForSelector(".player, .status").then(async() => {
                console.log("\x1b[32m√ \x1b[0mPlaying as \"" + username + "\"\n----------------------");

                joinGame(frame);
            });
        });
    });
}

async function newSyllable(frame, words) {

    typing = true;

    frame.waitForSelector(".otherTurn[hidden]").then(() => {
        frame.waitForSelector(".selfTurn > form > input", { visible: true }).then(() => {
            sleep(250).then(() => {
                findWord(frame, words).then(async(word) => {
                    await frame.type(".selfTurn > form > input", word).then(async() => {
                        if (word != "🤷‍♂️") {
                            await (await frame.$(".selfTurn > form > input")).press("Enter").then(() => {
                                sleep(100).then(async() => {
                                    await frame.evaluate(() => {
                                        return document.querySelector(".player").innerHTML
                                    }).then(player => {
                                        if (player === username) {
                                            missingLetters.some(char => {
                                                if (word.includes(char) && !missingLetters.includes(char)) {
                                                    missingLetters.push(missingLetters.indexOf(char));
                                                }
                                            });
                                        }
                                        typing = false;
                                    });
                                });
                            });
                        } else sleep(250).then(() => {
                            skip = true;
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
        frame.waitForSelector("div.syllable", { visible: true }).then(async() => {
            await frame.evaluate("document.querySelector('div.syllable').innerText").then(syllable => {
                var bestWords = words.filter(word => word.includes(syllable.toLowerCase()) && missingLetters.some(char => { return word.includes(char); }));
                if (bestWords === undefined) bestWords = words.filter(word => word.includes(syllable.toLowerCase()));
                if (bestWords[0] != undefined) {
                    bestWords.sort(function(a, b) {
                        return b.length - a.length;
                    });

                    words.splice(words.indexOf(bestWords[0]), 1);

                    missingLetters.some(char => {
                        if (bestWords[0].includes(char)) {
                            missingLetters.splice(missingLetters.indexOf(char), 1);
                        }
                    });
                } else bestWords = ["🤷‍♂️"];

                resolve(bestWords[0]);
            });
        });
    });
}

async function readChat(page) {
    await page.evaluate(() => {
        let observer = new MutationObserver(function() {
            var messageRaw = document.querySelectorAll(".chat .log div")[document.querySelectorAll(".chat .log div").length - 1];
            var message = {
                time: messageRaw.children[0].innerHTML,
                badges: [].map.call(messageRaw.children[1].children, function(node) {
                    return node.textContent.replace("👑", "\x1b[33mPL \x1b[0m").replace("⚔️", "\x1b[36mMOD \x1b[0m").replace("⭐", "\x1b[35mSTAFF \x1b[0m").replace("🎪", "\x1b[31mCREATOR \x1b[0m") || node.innerText.replace("⚔️", "\x1b[36mMOD \x1b[0m").replace("⭐", "\x1b[35mSTAFF \x1b[0m").replace("🎪", "\x1b[31mCREATOR \x1b[0m") || "";
                }).join("") || "",
                author: messageRaw.children[2].innerHTML.split("alt=\"\">")[1],
                text: messageRaw.children[3].innerHTML
            }
            newChat(message);
        });

        observer.observe(document.querySelector(".chat .log"), { childList: true, subtree: true });
    });
}

function newChat(message) {
    console.log("\x1b[32m" + message.time + " \x1b[36m> \x1b[0m" + (message.badges != "" ? message.badges + "| " : "") + (message.badges.includes("PL") ? "\x1b[1m" : "") + message.author + "\x1b[0m: " + message.text);
}

function chat(page, input) {
    if (typing) return chat(page, input);
    page.waitForSelector(".chat .input textarea", { visible: true }).then(async() => {
        typing = true;
        await page.type(".chat .input textarea", input).then(async() => {
            await (await page.$(".chat .input textarea")).press("Enter").then(() => {
                typing = false;
            });
        });
    });
}

function sleep(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(() => { resolve() }, ms);
    });
}

function generateCode() {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var code = "";
    for (var i = 0; i < 4; i++) {
        code += chars.split("")[Math.floor(Math.random() * chars.length)];
    }

    return code;
}