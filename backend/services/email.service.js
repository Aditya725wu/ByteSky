const nodemailer = require('nodemailer');

const env = require('../config/env');
const logger = require('../config/logger');

let transporter = null;

function isConfigured() {
  return Boolean(env.smtpHost && env.mailFrom);
}

function getTransporter() {
  if (!isConfigured()) {
    return null;
  }

  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    auth: env.smtpUser || env.smtpPass
      ? {
          user: env.smtpUser,
          pass: env.smtpPass
        }
      : undefined
  });

  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    logger.warn('Email skipped because SMTP is not configured', { to, subject });
    return { sent: false, skipped: true };
  }

  try {
    const info = await activeTransporter.sendMail({
      from: env.mailFrom,
      to,
      subject,
      text,
      html
    });

    logger.info('Email sent', { to, subject, messageId: info.messageId });
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Email send failed', { to, subject, error: error.message });
    return { sent: false, error: error.message };
  }
}

module.exports = {
  isConfigured,
  sendMail
};
