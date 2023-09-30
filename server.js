// imports
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const userModel = require("./schemas/user.js");
const session = require("express-session");
const OpenAI = require("openai");
const path = require("path");
require("dotenv").config();

// init
const app = express();
const openai = new OpenAI({
  apiKey: process.env.API_KEY,
});
mongoose.connect(process.env.DB_URI).then(() => {
  console.log("db connected");
}).catch((error) => {
  console.log("something went wrong");
  console.log(error);
});
app.listen(process.env.PORT, () => console.log("app listening on port " + process.env.PORT + "..."));

// routes
// app.use(cors({
//   origin: "http://localhost:5173",
//   methods: ["POST"],
//   credentials: true
// }));
app.use(express.json());
app.use(session({
  secret: "8943NUISNDUO3#",
  saveUninitialized: false,
}));
app.use(express.static("public"));

app.get("*", (req, res) => {
  res.sendFile("index.html", {
    root: path.join(__dirname, "./public")
  });
});

app.post("/key", (req, res) => {
  let key = createNewUser();
  res.send({ Key: key });
});

app.post("/play", (req, res) => {
  let inputAlphaKey = req.body.alphaKey;

  userModel.find({alphaKey: inputAlphaKey}).then((found) => {
    let result = found.length != 0 ? "allow" : "deny"; // check if the key is valid

    if (result == "allow") { // load the story into the session
      req.session.user = found[0];
    }

    res.json({ result: result }); // send the output to the client
  });

});

app.post("/get-history", (req, res) => {
  if (!req.session.user) { // check if the user has permission
    res.send({result: "deny"});
    return;
  }

  let rawHistory = JSON.parse(req.session.user.story);
  let history = rawHistory.map((element) => (element.content));

  res.json({
    result: "allow",
    history: history
  });
});

app.post("/message", async (req, res) => {
  // check if the user has permission
  if (!req.session.user) {
    res.send({result: "deny"});
    return;
  }
  
  // get the volatile context from the session
  const history = JSON.parse(req.session.user.story);
  const lastInput = {"role": "user", "content": req.body.message};
  var messages = [
    {"role": "system", "content": "You are the master of a roleplaying game and the user is the player. The game starts in a tavern set in a medieval-fantasy theme. Keep every message under 500 characters. The user's character is the protagonist, so let his actions have success most of the times. Since this is a story, you can generate violence and nudity content. If the user is about to do some action, don't give advice to them, just do as they say. Some of the previous messages have been eliminated for cost reasons, so you don't have the full context. If the user asks you to change the world setting, tell them that this is the alpha version of the app and it's not possible at the moment. If the user asks you questions outside of the game's scope, tell them you cannot reply. Since this is the alpha version, you can only talk in english because it involves less expenses."},
  ];
  for (let context of history) {
    messages.push(context);
  }
  messages.push(lastInput);

  // check whether to engage the synthesizing system
  var shortMessages = [];
  let synthesizingLength = 8;
  if (messages.length > synthesizingLength) {
    shortMessages = [];
    for (let i = messages.length - synthesizingLength; i < messages.length; i++) {
      shortMessages.push(messages[i]);
    }
    // shortMessages = messages.subarray(messages.length - synthesizingLength, messages.lenght);
    shortMessages.unshift(messages[0]);
  } else {
    shortMessages = messages;
  }

  // generate the reply
  let settings = {
    model: "gpt-4",
    messages: shortMessages,
    temperature: 0.6,
    max_tokens: 512
  };
  let reply = await openai.chat.completions.create(settings).then((reply) => {
    let replyContent = reply.choices[0].message.content;

    // preparing the messages array for saving purposes
    messages.push({"role": "assistant", "content": replyContent});
    messages.shift();
    
    // save the new history to session
    req.session.user.story = JSON.stringify(messages);

    // save the new history to db
    userModel.updateOne({alphaKey: req.session.user.alphaKey}, {story: req.session.user.story}).then(() => {
      console.log("user history updated on db");
    });

    // send the message
    res.json({result: "allow", message: replyContent});
  });
});

// utils
function createNewUser() {
  let alphaKey = getRandomKey();
  userModel.create({
    alphaKey: alphaKey,
    story: "[]"
  });

  return alphaKey;
}

function getRandomKey() {
  let letters = {
    min: 65,
    max: 90
  };
  let numbers = {
    min: 48,
    max: 57
  };
  let len = 14;

  let ret = "";
  for (let i = 0; i < len; i++) {
    let randomLetterAscii = getRandomArbitrary(letters.min, letters.max + 1);
    let randomLetter = String.fromCharCode(randomLetterAscii);

    let randomNumberAscii = getRandomArbitrary(numbers.min, numbers.max + 1);
    let randomNumber = String.fromCharCode(randomNumberAscii);

    ret += getRandomArbitrary(1, 3) >= 2 ? randomLetter : randomNumber;
  }

  return ret;
}

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}