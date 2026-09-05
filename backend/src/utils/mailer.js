const nodemailer = require('nodemailer');

const createTransporter = () => {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  // Fallback test account transporter or mock
  return {
    sendMail: async (options) => {
      console.log('📧 [Mock Email Dispatcher]:');
      console.log(`   To: ${options.to}`);
      console.log(`   Subject: ${options.subject}`);
      console.log(`   Body preview: ${options.text || options.html}`);
      return { messageId: 'mock-' + Date.now() };
    },
  };
};

const transporter = createTransporter();

const sendEmailNotification = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: `"DealFlow360" <${process.env.EMAIL_USER || 'notifications@dealflow360.internal'}>`,
      to,
      subject,
      text: text || 'You have an update on DealFlow360.',
      html,
    });
    return info;
  } catch (error) {
    console.error('Email dispatch failed:', error.message);
    return null;
  }
};

module.exports = {
  transporter,
  sendEmailNotification,
};
