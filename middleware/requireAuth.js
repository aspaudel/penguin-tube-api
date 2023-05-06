const jwt = require("jsonwebtoken");
const User = require("../models/user");

async function requireAuth(req, res, next) {
  try {
    console.log("1: Start");
    const token = req.cookies.Authorization;
    console.log("2");
    console.log(token);
    const decoded = jwt.verify(token, process.env.SECRET);
    console.log("3");
    console.log(decoded);
    if (Date.now() > decoded.exp) return res.sendStatus(401);
    console.log("4");
    const user = await User.findById(decoded.sub);
    console.log("5");
    console.log(user);
    if (!user) return res.sendStatus(401);
    console.log("6");
    req.user = user;
    console.log("7");
    console.log(req);
    next();
  } catch (err) {
    console.log("In here");
    return res.sendStatus(401);
  }
}

module.exports = requireAuth;
