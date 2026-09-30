import nodemailer from 'nodemailer'



export const sendEmail = async ({ to, subject, html }) => {


    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        },

    })

    await transporter.sendMail({
        from: `"My Website" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html
    })
}