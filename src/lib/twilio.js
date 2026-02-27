import twilio from 'twilio';

let client = null;

// Only initialize Twilio if valid credentials are provided
const sid = process.env.TWILIO_ACCOUNT_SID;
if (sid && sid.startsWith('AC')) {
    client = twilio(sid, process.env.TWILIO_AUTH_TOKEN);
}

export const sendSMS = async (to, body) => {
    if (!client) {
        console.log(`[Twilio - DEV] SMS skipped → to: ${to}, body: ${body}`);
        return null;
    }

    return client.messages.create({
        to,
        from: process.env.TWILIO_PHONE_NUMBER,
        body,
    });
};

export default client;
