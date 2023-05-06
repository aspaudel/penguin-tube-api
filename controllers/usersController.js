const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

async function signup(req, res) {
  try {
    console.log("Signup: " + req.body);
    const { username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);
    const user = await User.create({ username, password: hashedPassword });
    if (user) {
      const rootPath = path.join(__dirname);
      const dir = `${rootPath}/../uploads/${user._id}`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(400);
  }
}

async function login(req, res) {
  try {
    console.log("Login: " + req.body);
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.sendStatus(401);
    const passwordMatch = bcrypt.compareSync(password, user.password);
    if (!passwordMatch) return res.sendStatus(401);
    const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
    const token = jwt.sign({ sub: user._id, exp }, process.env.SECRET);
    res.cookie("Authorization", token, {
      expires: new Date(exp),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    return res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(400);
  }
}

async function logout(req, res) {
  try {
    res.clearCookie("Authorization");
    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(400);
  }
}

function checkAuth(req, res) {
  try {
    res.sendStatus(200);
  } catch (err) {
    return res.sendStatus(400);
  }
}

async function updateVideoLikes(req, res) {
  const { videoName, value } = req.body;
  console.log(req.user);
  console.log(videoName);
  console.log(value);
  const user = await User.findOne({ _id: req.user._id });
  let con = false;

  console.log(user);
  user?.likes.forEach((videoname) => {
    console.log("here");
    console.log(videoname);
    if (videoname == videoName) con = true;
  });
  if (value === 1 && con) {
    return res.sendStatus(400);
  } else if (value === -1 && !con) {
    return res.sendStatus(400);
  } else {
    await axios
      .post("https://penguin-tube.000webhostapp.com/updateVideoLikes.php", {
        videoName,
        value,
      })
      .then(async (response) => {
        console.log(response.data);
        if (response.data.response_code === 200) {
          console.log("Mongo db update");
          if (value === 1) {
            await User.findOneAndUpdate(
              { _id: req.user._id },
              { $push: { likes: videoName } }
            );
          } else if (value === -1) {
            await User.findOneAndUpdate(
              { _id: req.user._id },
              { $pull: { likes: videoName } }
            );
          }
          return res.sendStatus(200);
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }
}

async function getLikeState(req, res) {
  const { videoName } = req.body;
  const user = await User.findOne({ _id: req.user._id });
  let con = false;
  user?.likes.forEach((videoname) => {
    if (videoname == videoName) con = true;
  });
  if (con) return res.json("true");
  else return res.json("false");
}

module.exports = {
  signup,
  login,
  checkAuth,
  logout,
  updateVideoLikes,
  getLikeState,
};
