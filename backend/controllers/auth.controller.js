const authService = require('../services/auth.service');

async function register(req, res, next) {
  try {
    const payload = await authService.register(req.body, req);
    return res.status(201).json(payload);
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const payload = await authService.login(req.body, req);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function googleLogin(req, res, next) {
  try {
    const payload = await authService.googleLogin(req.body, req);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const payload = await authService.updateProfile(req.user.id, req.body, req);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    const payload = await authService.changePassword(req.user.id, req.body, req);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function getCurrentUser(req, res, next) {
  try {
    const payload = await authService.getCurrentUser(req.user.id);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  changePassword,
  getCurrentUser,
  googleLogin,
  login,
  register,
  updateProfile
};
