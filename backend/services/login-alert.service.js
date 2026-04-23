const Notification = require('../models/Notification');
const emailService = require('./email.service');
const logger = require('../config/logger');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getIpAddress(req) {
  const forwardedFor = req.get?.('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'Unknown';
}

function getUserAgent(req) {
  return req.get?.('user-agent') || 'Unknown';
}

function getRequestContext(req) {
  return {
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    occurredAt: new Date()
  };
}

function getLoginAlertPreferences(user) {
  return {
    emailOnNewDevice: user.loginAlerts?.emailOnNewDevice !== false,
    emailOnFailedLogin: user.loginAlerts?.emailOnFailedLogin === true
  };
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  }).format(date);
}

function buildTextBody({ heading, intro, context }) {
  return [
    heading,
    '',
    intro,
    '',
    `Time: ${formatDate(context.occurredAt)} IST`,
    `IP address: ${context.ipAddress}`,
    `Device: ${context.userAgent}`,
    '',
    'If this was you, no action is needed. If this was not you, change your password immediately and review your account security settings.'
  ].join('\n');
}

function buildHtmlBody({ heading, intro, context }) {
  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.55;">
      <h2 style="margin: 0 0 12px;">${escapeHtml(heading)}</h2>
      <p>${escapeHtml(intro)}</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 6px 12px 6px 0; color: #64748b;">Time</td>
          <td style="padding: 6px 0;">${escapeHtml(formatDate(context.occurredAt))} IST</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; color: #64748b;">IP address</td>
          <td style="padding: 6px 0;">${escapeHtml(context.ipAddress)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; color: #64748b;">Device</td>
          <td style="padding: 6px 0;">${escapeHtml(context.userAgent)}</td>
        </tr>
      </table>
      <p>If this was you, no action is needed. If this was not you, change your password immediately and review your account security settings.</p>
    </div>
  `;
}

async function createNotification(user, { title, message, type = 'warning' }) {
  try {
    await Notification.create({
      user: user._id,
      title,
      message,
      type
    });
  } catch (error) {
    logger.warn('Login alert notification failed', { userId: user._id, error: error.message });
  }
}

async function sendAlertEmail(user, { subject, heading, intro, context }) {
  await emailService.sendMail({
    to: user.email,
    subject,
    text: buildTextBody({ heading, intro, context }),
    html: buildHtmlBody({ heading, intro, context })
  });
}

async function notifyNewDeviceLogin(user, req) {
  const context = getRequestContext(req);
  const preferences = getLoginAlertPreferences(user);
  const intro = 'A new device just signed in to your ByteSky Cloud account.';

  await createNotification(user, {
    title: 'New device login',
    message: `${intro} IP: ${context.ipAddress}`,
    type: 'warning'
  });

  if (!preferences.emailOnNewDevice) {
    return;
  }

  await sendAlertEmail(user, {
    subject: 'New device login to your ByteSky Cloud account',
    heading: 'New device login detected',
    intro,
    context
  });
}

async function notifyFailedLogin(user, req) {
  const context = getRequestContext(req);
  const preferences = getLoginAlertPreferences(user);
  const intro = 'Someone tried to sign in to your ByteSky Cloud account with an incorrect password.';

  if (!preferences.emailOnFailedLogin) {
    return;
  }

  await createNotification(user, {
    title: 'Failed login attempt',
    message: `${intro} IP: ${context.ipAddress}`,
    type: 'danger'
  });

  await sendAlertEmail(user, {
    subject: 'Failed login attempt on your ByteSky Cloud account',
    heading: 'Failed login attempt detected',
    intro,
    context
  });
}

module.exports = {
  notifyFailedLogin,
  notifyNewDeviceLogin
};
