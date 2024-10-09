if (process.env.NODE_ENV !== "production") {
  require('dotenv').config();
}
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const listingsRouter = require("./routes/listing.js");
const reviewsRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const ExpressError = require('./utils/ExpressError.js');

const dbURL = process.env.ATLASTDB_URL || "mongodb://127.0.0.1:27017/wanderlust"; // Default value

const store = MongoStore.create({
  mongoUrl: dbURL,
  crypto: {
    secret: process.env.secret || 'defaultsecret', // Default secret
  },
  touchAfter: 24 * 3600, // Only update session every 24 hours
});

store.on("error", (err) => {
  console.log("Error in MongoStore", err);
});

const sessionOptions = {
  store,
  secret: process.env.secret || 'defaultsecret', // Default secret
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 1000 * 60 * 60 * 24 * 3, // 3 days
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
  },
};

app.use(express.static(path.join(__dirname, "/public")));
app.use(express.urlencoded({ extended: true })); // Body parser to handle form data
app.use(methodOverride("_method"));
app.use(session(sessionOptions));
app.use(flash());
app.engine('ejs', ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

async function main() {
  try {
    await mongoose.connect(dbURL);
    console.log("Connected to DB");
  } catch (err) {
    console.error("DB connection error:", err);
  }
}
main();

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

app.use('/listings', listingsRouter);
app.use("/listings/:id/reviews", reviewsRouter);
app.use("/", userRouter);

app.get("/demouser", async (req, res) => {
  let fakeUser = new User({
    email: "abc@gmail.com",
    username: "abc"
  });
  let registeredUser = await User.register(fakeUser, "helloworld");
  res.send(registeredUser);
});

app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page not found"));
});

app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong!" } = err;
  res.status(statusCode).render("Error.ejs", { message });
});

app.listen(8080, () => {
  console.log("Server is listening on port 8080");
});
