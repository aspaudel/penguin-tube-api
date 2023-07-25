if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

const express = require("express");
const connectToDb = require("./config/connectToDb");
const usersController = require("./controllers/usersController");
const videosController = require("./controllers/videosController");
const requireAuth = require("./middleware/requireAuth");
const cookieParser = require("cookie-parser");
const cors = require("cors");
/*
const formData = require("form-data");
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
*/

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "https://penguin-tube.onrender.com",
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use("/uploads", express.static("uploads"));

connectToDb();

app.post("/", videosController.getServerVideos);

app.post("/signup", usersController.signup);
app.post("/login", usersController.login);
app.get("/logout", usersController.logout);
app.get("/checkAuth", requireAuth, usersController.checkAuth);
app.post("/updateVideoLikes", requireAuth, usersController.updateVideoLikes);
app.post("/getLikeState", requireAuth, usersController.getLikeState);

app.post("/uploadVideo", requireAuth, videosController.uploadVideo);
app.post("/thumbnail", requireAuth, videosController.createThumbnail);
app.get("/videoPage/:videoName", videosController.getVideo);
app.post("/renameVideoFile", requireAuth, videosController.renameVideoFile);
app.post("/deleteVideoFile", requireAuth, videosController.deleteVideoFile);

app.get(
  "/masterDeletionAccount",
  requireAuth,
  videosController.masterDeletionAccount
);

app.get("/userProfile", requireAuth, videosController.getUserVideos);

app.listen(process.env.PORT, () => {
  console.log(`Listening on port ${process.env.PORT}`);
});
