import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";
import qs from "querystring";
import cors from "cors";
import bodyParser from "body-parser";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const mongodbUri = process.env.MONGODB_URI;

app.use(
  cors({
    origin: "https://englishbonfire.netlify.app",
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(mongodbUri);

const Authorization = () => {
  return encodeURI(`https://linkedin.com/oauth/v2/authorization?client_id=${process.env.LINKEDIN_ID}&response_type=code&scope=${process.env.SCOPE}&redirect_uri=${process.env.REDIRECT_URI}`);
};

const Redirect = async (code) => {
  const payLoad = {
    client_id: process.env.LINKEDIN_ID,
    client_secret: process.env.LINKEDIN_SECRET,
    redirect_uri: process.env.REDIRECT_URI,
    grant_type: "authorization_code",
    code: code,
  };
  const { data } = await axios({
    url: `https://linkedin.com/oauth/v2/accessToken?${qs.stringify(payLoad)}`,
    method: "POST",
    headers: {
      "Content-Type": "x-www-form-urlencoded",
    },
  })
    .then((response) => {
      return response;
    })
    .catch((error) => {
      return error;
    });
  return data;
};

const userSchema = new mongoose.Schema({
  sub: String,
  firstName: String,
  lastName: String,
  profile: String,
  status: String,
  camp: [String],
});

let identity = "";
const User = mongoose.model("User", userSchema);

app.get("/", (req, res) => {
  res.send("welcome");
});

app.get("/auth/linkedin", (req, res) => {
  return res.redirect(Authorization());
});

app.get("/auth/linkedin/callback", async (req, res) => {
  const code = await Redirect(req.query.code);
  const token = code.access_token;
  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  try {
    const fetch = await axiosInstance.get("https://api.linkedin.com/v2/userinfo");
    const result = await fetch.data;
    const { sub, given_name, family_name, picture } = result;
    const exist = await User.findOne({ sub: sub });
    if (exist === null) {
      const newUser = new User({
        sub: sub,
        firstName: given_name,
        lastName: family_name,
        profile: picture,
        status: "member",
        camp: [],
      });
      newUser.save().then(() => {
        console.log("new account");
        identity = newUser.sub;
        res.redirect("https://englishbonfire.netlify.app");
      });
    } else {
      console.log("account found");
      identity = sub;
      res.redirect("https://englishbonfire.netlify.app");
    }
  } catch (error) {
    res.send(error);
  }
});

app.get("/personal", async (req, res) => {
  const user = await User.findOne({ sub: identity });
  identity = "";
  res.json(user);
});

app.get("/community", async (req, res) => {
  const community = await User.find();
  res.json(community);
});

app.post("/coba", (req, res) => {
  const makan = req.body.makan;
  const minum = req.body.minum;
  res.json({ makanan: makan, minuman: minum });
});

app.post("/join", async (req, res) => {
  const id = req.body && req.body.id;
  const sub = req.body && req.body.sub;
  if (id !== undefined && sub !== undefined) {
    try {
      const user = await User.findOne({ sub: sub });
      const exist = user && user.camp.includes(id);
      if (!exist) {
        await User.updateOne({ sub: sub }, { $push: { camp: id } });
        res.redirect("https://englishbonfire.netlify.app/bivouac/finished");
      } else {
        res.redirect("https://englishbonfire.netlify.app/unknown");
      }
    } catch (error) {
      res.redirect("https://englishbonfire.netlify.app/unknown");
    }
  } else {
    res.redirect("https://englishbonfire.netlify.app/unknown");
  }
});

app.post("/something", (req, res) => {
  res.redirect("https://englishbonfire.netlify.app/unknown");
});

app.get("/logout", (req, res) => {
  identity = "";
  res.redirect("https://englishbonfire.netlify.app");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`your app is running on port ${port}`);
});
