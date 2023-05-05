const multer = require("multer");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const axios = require("axios");
const fs = require("fs");
const User = require("../models/user");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, `uploads/${req.user._id}`);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = req.user._id + "-" + Date.now() + "-"; //+ "-" + Math.round(Math.random() * 1e9);
    initiliazeDataToMySQL(uniqueSuffix + file.originalname);
    cb(null, uniqueSuffix + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    if (ext !== ".mp4") {
      return cb(new Error("Only images are allowed"));
    }
    cb(null, true);
  },
}).single("file");

function uploadVideo(req, res) {
  upload(req, res, (err) => {
    if (err) {
      return res.json({ success: false, err });
    }
    return res.json({
      success: true,
      filePath: res.req.file.path,
      fileName: res.req.file.filename,
    });
  });
}

function createThumbnail(req, res) {
  let thumbsFilePath = "";
  let fileDuration = "";

  ffmpeg.ffprobe(req.body.filePath, function (err, metadata) {
    fileDuration = metadata.format.duration;
  });

  ffmpeg(req.body.filePath)
    .on("filenames", function (filenames) {
      thumbsFilePath = "uploads/thumbnails/" + filenames[0];
    })
    .on("end", function () {
      return res.json({ success: true, thumbsFilePath, fileDuration });
    })
    .screenshots({
      // Will take screens at 20%, 40%, 60% and 80% of the video if count = 4
      count: 1,
      folder: "uploads/thumbnails",
      size: "320x240",
      filename: "thumbnail-%b.png",
    });
}

async function initiliazeDataToMySQL(videoName) {
  const videoData = {
    videoName,
    uploadTime: Date.now(),
    likes: 0,
  };

  await axios
    .post("https://penguin-tube.000webhostapp.com/insertVideoData.php", {
      videoData,
    })
    .then((response) => {
      if (response?.data?.response_code === 200) {
        console.log("Successfully inserted the data to MySQL");
        return;
      } else {
        console.log(response.data);
        return new Error();
      }
    })
    .catch((err) => {
      initiliazeDataToMySQL(videoName);
      console.log(err);
    });
}

async function getVideo(req, res) {
  const rootPath = path.join(__dirname);
  const fileName = req.params.videoName;
  const file = req.params.videoName.substring(0, 24);
  const filePath = `${rootPath}/../uploads/${file}/${fileName}`;
  console.log("fileName: " + fileName);
  console.log("filePath: " + filePath);
  if (!filePath) {
    return res.status(404).send("File not found");
  }
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  if (range) {
    const CHUNK_SIZE = 10 ** 6 * 3;
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start + CHUNK_SIZE, fileSize - 1);
    const contentLength = end - start + 1;

    //Video file exists in the server even after deleting it in this case "more often".
    //const parts = range.replace(/bytes=/, "").split("-");
    //const start = parseInt(parts[0], 10);
    //const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    //const chunkSize = end - start + 1;

    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": contentLength,
      "Content-Type": "video/mp4",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: 0,
    };
    res.writeHead(206, head);
    file.on("close", () => {
      console.log("Stream has been destroyed");
      file.destroy();
    });
    file.on("error", (err) => {
      console.log("File stream error encountered");
      file.destroy();
    });
    file.pipe(res);

    // file
    //   .on("close", (err) => {
    //     console.log("Stream has been destroyed");
    //     file.destroy();
    //   })
    //   .on("data", (chunk) => {
    //     console.log("Data chunk: ");
    //   })
    //   .on("end", () => {
    //     console.log("Stream ended");
    //     file.destroy();
    //   });
  } else {
    res.status(400).send("Requires Range header");
    // const head = {
    //   "Content-Length": fileSize,
    //   "Content-Type": "video/mp4",
    // };
    // res.writeHead(200, head);
    // fs.createReadStream(filePath).pipe(res);
  }
}

async function getServerVideos(req, res) {
  //res.sendFile(path.join(__dirname, "/index.html"));
  let paths = [];

  const videoPaths = "./uploads/thumbnails";

  fs.readdirSync(videoPaths).forEach((file) => {
    paths.push(file);
  });

  return res.json({ paths });
}

async function renameVideoFile(req, res) {
  console.log(req.body);
  let { oldVideoName, newVideoName } = req.body;
  const Date = oldVideoName.substring(25, 37);
  newVideoName = `${req.user._id}-${Date}-${newVideoName}`;
  const videoData = {
    oldVideoName,
    newVideoName,
  };

  await axios
    .post("https://penguin-tube.000webhostapp.com/renameVideoId.php", {
      videoData,
    })
    .then(async (response) => {
      console.log(response.data);
      console.log(response.data.response_code);
      if (response.data.response_code === 200) {
        const users = await User.find({});
        //const user = await User.findOne({ _id: req.user._id });
        users.forEach((user) => {
          user.likes.forEach(async (name) => {
            if (name === oldVideoName) {
              await User.findOneAndUpdate(
                { _id: user._id },
                { $pull: { likes: oldVideoName } }
              );
              await User.findOneAndUpdate(
                { _id: user._id },
                { $push: { likes: newVideoName } }
              );
            }
          });
        });
        fs.rename(
          `./uploads/${req.user._id}/${oldVideoName}`,
          `./uploads/${req.user._id}/${newVideoName}`,
          function (err) {
            if (err) {
              con1 = false;
              console.log("ERROR: " + err);
            }
          }
        );
        let oldThumbnailName = oldVideoName.substring(
          0,
          oldVideoName.length - 3
        );
        oldThumbnailName = "thumbnail-" + oldThumbnailName + "png";
        let newThumbnailName = newVideoName.substring(
          0,
          newVideoName.length - 3
        );
        newThumbnailName = "thumbnail-" + newThumbnailName + "png";
        fs.rename(
          `./uploads/thumbnails/${oldThumbnailName}`,
          `uploads/thumbnails/${newThumbnailName}`,
          function (err) {
            if (err) {
              con2 = false;
              console.log("Error: " + err);
            }
          }
        );
        res.json(newVideoName);
      } else {
        res.writeHead(400);
      }
    })
    .catch((err) => {
      console.log(err);
    });
  return res.end();
}

async function deleteVideoFile(req, res) {
  console.log(req.body);
  let { videoName, thumbnailName } = req.body;
  videoName = videoName.substring();
  await axios
    .post(
      "https://penguin-tube.000webhostapp.com/deleteVideoEntry.php",
      videoName
    )
    .then(async (response) => {
      console.log(response.data);
      if (response.data.response_code === 200) {
        const users = await User.find({});
        users.forEach(async (user) => {
          await User.findOneAndUpdate(
            { _id: user._id },
            { $pull: { likes: videoName } }
          );
        });

        fs.unlink(`uploads/${req.user._id}/${videoName}`, (err) => {
          if (err) console.log("Video Delete Backend Error: " + err);
        });
        fs.unlink(`uploads/thumbnails/${thumbnailName}`, (err) => {
          if (err) console.log("Video thumbnail delete error");
        });

        res.writeHead(200);
      } else {
        res.writeHead(400);
      }
    })
    .catch((err) => {
      res.writeHead(400);
      console.log(err);
    });
  return res.end();
}

async function getUserVideos(req, res) {
  //res.sendFile(path.join(__dirname, "/index.html"));
  let paths = [];

  const videoPaths = "./uploads/thumbnails";
  const userId = req.user._id;

  fs.readdirSync(videoPaths).forEach((file) => {
    paths.push(file);
  });
  paths = paths.filter((file) => {
    return file.toString().substring(10, 34) === userId.toString();
  });

  return res.json({ paths });
}

async function masterDeletionAccount(req, res) {
  let paths = [];
  const videoPaths = "./uploads/thumbnails";
  const userId = req.user._id;

  // Get all the thumbnails
  fs.readdirSync(videoPaths).forEach((file) => {
    paths.push(file);
  });

  // Filter thumbnails based on userId
  paths = paths.filter((file) => {
    return file.toString().substring(10, 34) === userId.toString();
  });

  let videoNames = [];

  // Convert thumbnail names to videonames
  paths.forEach(async (file) => {
    let videoName = file.substring(10, file.length - 4);
    videoName = videoName + ".mp4";
    videoNames.push(videoName);
  });

  //Delete the userId folder
  const deleteFolderRecursive = function (
    directoryPath = `uploads/${req.user._id}`
  ) {
    if (fs.existsSync(directoryPath)) {
      fs.readdirSync(directoryPath).forEach((file, index) => {
        const curPath = path.join(directoryPath, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          // recurse
          deleteFolderRecursive(curPath);
        } else {
          // delete file
          fs.unlinkSync(curPath, (err) => {
            if (err) console.log(err);
          });
        }
      });
      fs.rmdirSync(directoryPath, { recursive: true }, (err) => {
        if (err) console.log(err);
      });
    }
  };
  deleteFolderRecursive();

  // Delete all the videonames from MySql
  videoNames.forEach(async (videoName) => {
    await axios
      .post(
        "https://penguin-tube.000webhostapp.com/deleteVideoEntry.php",
        videoName
      )
      .then((response) => {});
  });

  // Delete videonames from mongoDB
  const users = await User.find({});
  users.forEach(async (user) => {
    videoNames.forEach(async (videoName) => {
      await User.findOneAndUpdate(
        { _id: user._id },
        { $pull: { likes: videoName } }
      );
    });
  });

  // Delete all the thumbnails
  paths.forEach((file) => {
    fs.unlink(`uploads/thumbnails/${file}`, (err) => {
      if (err) console.log("Video thumbnail delete error");
    });
  });

  // Delete the user from mongoDB
  User.findById(userId)
    .then((user) => {
      if (user) {
        return user.deleteOne();
      }
      throw new Error("User not found");
    })
    .then(() => {
      console.log("User deleted successfully");
    })
    .catch((error) => {
      console.log(error);
    });

  try {
    res.clearCookie("Authorization");
    return res.sendStatus(200);
  } catch (err) {
    console.log(err);
    return res.sendStatus(400);
  }
}

module.exports = {
  uploadVideo,
  createThumbnail,
  getVideo,
  getServerVideos,
  renameVideoFile,
  deleteVideoFile,
  getUserVideos,
  masterDeletionAccount,
};
