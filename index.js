const puppeteer = require("puppeteer");
const { keyboard } = require("@nut-tree/nut-js");
const prompts = require("prompts");
const fs = require("fs");

keyboard.config.autoDelayMs = 0;

var words;
var code;

fs.readFile("./words.txt", "utf8", (err, data) => {
    words = data.toLowerCase().split("\r\n");

    (async() => {
        const response = await prompts({
            type: "text",
            name: "value",
            message: "Lobby code:"
        });

        code = response.value;

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
            console.log("Accessed webpage");
            await page.evaluate(() => {
                document.querySelector(".nickname").value = "bot";
                document.querySelector(".nickname").nextElementSibling.click();
            }).then(async() => {
                console.log("Entered room");
                page.waitForSelector("iframe").then(() => {
                    page.$("iframe").then(async(iframe) => {
                        const frame = await iframe.contentFrame();
                        console.log("Got iframe");
                        frame.waitForSelector(".joinRound").then(() => {
                            frame.evaluate(() => {
                                document.querySelector(".joinRound").click();
                                return milestone;
                            }).then(milestone => {
                                console.log(milestone);
                                console.log("Joined round");
                                frame.waitForSelector(".round + .selfTurn > form > input").then(() => {
                                    findWord(frame, words).then(word => {
                                        frame.evaluate((word) => {
                                            document.querySelector(".selfTurn > form > input").value = word;
                                            document.querySelector(".selfTurn > form > input").enterKeyHint("enter");
                                        }, word);
                                    });
                                });
                            });
                        });
                    });
                });
            });


            // sleep(2000).then(async() => {
            //     await page.screenshot({ path: "example.png" });

            //     await browser.close();
            // });
        })();
    })();
});

async function findWord(frame, words) {
    return new Promise(async(resolve, reject) => {
        frame.waitForSelector("div.syllable").then(async() => {
            sleep(1000).then(async() => {
                await frame.evaluate("document.querySelector('div.syllable').innerText").then(syllable => {
                    var goodWords = words.filter(word => word.includes(syllable.toLowerCase()));
                    goodWords.sort(function(a, b) {
                        return b.length - a.length;
                    });

                    console.log(syllable, goodWords[0]);

                    words.splice(words.indexOf(goodWords[0]), 1);

                    resolve(goodWords[0]);
                });
            });
        });
    });
}

function sleep(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(() => { resolve() }, ms);
    })
}