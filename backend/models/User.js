const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  role: {
    type: String,
    enum: ['admin', 'developer', 'viewer', 'user'],
    default: 'user'
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  googleId: { type: String, sparse: true, index: true },
  avatar: { type: String },
  policies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Policy' }],
  twoFAEnabled: { type: Boolean, default: false },
  twoFASecret: { type: String },
  lastLogin: { type: Date }
});


// HASH PASSWORD BEFORE SAVE
UserSchema.pre('save', async function () {

  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

});


// COMPARE PASSWORD
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};


module.exports = mongoose.model('User', UserSchema);
