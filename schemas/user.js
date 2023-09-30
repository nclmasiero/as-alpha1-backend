const { Schema } = require("mongoose");
const mongoose = require("mongoose");

userSchema = new Schema({
  alphaKey: String,
  story: String,
});

module.exports = mongoose.model("User", userSchema);