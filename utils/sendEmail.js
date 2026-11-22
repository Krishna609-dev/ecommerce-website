
const nodemailer = require('nodemailer');

let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

async function sendEmail(email, otp, purpose = 'registration') {
    let subject;
    let message;

    if (purpose === 'password-reset') {
        subject = 'E-commerce Password Reset';
        message = `Your password reset OTP is ${otp}. It expires in 10 minutes. Do not share this code with anyone.`;
    } else {
        subject = 'E-commerce Email Verification';
        message = `Your email verification OTP is ${otp}. It expires in 10 minutes.`;
    }

    if (transporter) {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject,
            text: message
        });
    } else {
        console.log(`OTP for ${email}: ${otp}`);
        console.log(`Purpose: ${purpose}`);
    }
}

module.exports = sendEmail;









// const nodemailer = require('nodemailer');

// let transporter = null;

// if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
//     transporter = nodemailer.createTransport({
//         service: 'gmail',
//         auth: {
//             user: process.env.EMAIL_USER,
//             pass: process.env.EMAIL_PASS
//         }
//     });
// }

// async function sendEmail(email, otp) {
//     if (transporter) {
//         await transporter.sendMail({
//             from: process.env.EMAIL_USER,
//             to: email,
//             subject: 'E-commerce email verification',
//             text: `Your verification code is ${otp}. It expires in 10 minutes.`
//         });
//     } else {
//         console.log(`OTP for ${email}: ${otp}`);
//     }
// }

// module.exports = sendEmail;
