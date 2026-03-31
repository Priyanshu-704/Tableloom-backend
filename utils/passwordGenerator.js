const generatePassword = () => {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const number = '0123456789';
  const special = '!@#$%^&*';

  const pick = (str) => str[Math.floor(Math.random() * str.length)];

  let password = [
    pick(upper),
    pick(upper),
    pick(lower),
    pick(lower),
    pick(number),
    pick(number),
    pick(special),
    pick(special),
  ];

  // Shuffle for randomness
  return password.sort(() => Math.random() - 0.5).join('');
};

module.exports = generatePassword;


module.exports = generatePassword;