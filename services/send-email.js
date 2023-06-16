require('dotenv').config();
const nodemailer = require("nodemailer");
// async..await is not allowed in global scope, must use a wrapper
module.exports = async function sendEmail(to, subject, body) {
    console.log(to, subject, body);
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
      host: process.env.STMP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.STMP_USER, // generated ethereal user
        pass: process.env.STMP_PASS, // generated ethereal password
      },
    });
  
    // send mail with defined transport object
    let info = await transporter.sendMail({
      from: process.env.SMTP_FROM, // sender address
      to: to, // list of receivers
      subject: subject, // Subject line
      text: body, // plain text body
      html: body, // html body
    }).catch((err) => {
      console.log(err);
    });
  
    console.log("Message sent: %s", info.messageId);
    // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
  
    // Preview only available when sending through an Ethereal account
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou
  }