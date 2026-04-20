const crypto = require("crypto");

const securePick = (characters = "") =>
  characters[crypto.randomInt(0, characters.length)];

const secureShuffle = (items = []) => {
  const values = [...items];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(0, index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
};

const generatePassword = () => {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const number = "0123456789";
  const special = "!@#$%^&*";
  const password = [
    securePick(upper),
    securePick(upper),
    securePick(lower),
    securePick(lower),
    securePick(number),
    securePick(number),
    securePick(special),
    securePick(special),
  ];
  return secureShuffle(password).join("");
};
module.exports = generatePassword;
