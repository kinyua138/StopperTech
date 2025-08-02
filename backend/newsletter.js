const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

async function sendNewsletterEmail(toEmail) {
    const mailOptions = {
        from: `"Stopper Tech" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: 'Newsletter Subscription Confirmation',
        text: 'Thank you for subscribing to the Stopper Tech newsletter! You will receive updates on new services and special offers.',
        html: '<p>Thank you for subscribing to the <b>Stopper Tech</b> newsletter! You will receive updates on new services and special offers.</p>',
    };

    return transporter.sendMail(mailOptions);
}

module.exports = {
    sendNewsletterEmail,
};
