import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const { to, subject, message } = await req.json();

    const data = await resend.emails.send({
      from: "FlowGo <obchod@flowgo.cz>",
      to,
      subject,
      text: message,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}