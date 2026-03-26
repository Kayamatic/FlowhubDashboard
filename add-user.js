// Usage: node add-user.js <username> <password>
// Adds or updates a user in users.json with a bcrypt-hashed password.
const bcrypt = require('bcryptjs');
const fs     = require('fs');
const path   = require('path');

const [,, username, password] = process.argv;
if (!username || !password) {
  console.error('Usage: node add-user.js <username> <password>');
  process.exit(1);
}

const USERS_FILE = path.join(__dirname, 'users.json');
const users = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')) : {};

const hash = bcrypt.hashSync(password, 12);
users[username] = hash;
fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
console.log('✅ User "' + username + '" saved to users.json');
