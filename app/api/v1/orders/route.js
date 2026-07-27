import { supabase } from "../../../lib/supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

async function sendOrderNotification(order) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const notificationEmail =
    process.env.ORDER_NOTIFICATION_EMAIL || "obchod@flowgo.cz";
  const fromEmail =
    process.env.RESEND_FROM_EMAIL || "obchod@flowgo.cz";

  if (!resendApiKey) {
    throw new Error("Chýba RESEND_API_KEY.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `FlowGo objednávky <${fromEmail}>`,
      to: [notificationEmail],
      subject: "Nová objednávka na business.flowgo.cz",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 650px;">
          <h2 style="color: #16a765;">Nová objednávka FlowGo</h2>

          <p>Na business.flowgo.cz bola vytvorená nová objednávka.</p>

          <p>
            <strong>Vyzdvihnutie:</strong><br>
            ${order.pickup_address || "Neuvedené"}
          </p>

          <p>
            <strong>Doručenie:</strong><br>
            ${order.delivery_address || "Neuvedené"}
          </p>

          <p>
            <strong>Zákaznícky e-mail:</strong><br>
            ${order.user_email || "Neuvedené"}
          </p>

          <p>
            <strong>Cena:</strong><br>
            ${Number(order.price || 0).toLocaleString("cs-CZ")} Kč
          </p>

          <p>
            <strong>Stav:</strong><br>
            ${order.status || "Nová objednávka"}
          </p>

          <p style="margin-top: 25px;">
            <a
              href="https://business.flowgo.cz"
              style="
                display: inline-block;
                background: #16a765;
                color: white;
                padding: 12px 18px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: bold;
              "
            >
              Otvoriť objednávky
            </a>
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend chyba: ${response.status} – ${errorText}`);
  }

  return response.json();
}

export async function POST(req) {
  try {
    const data = await req.json();

    console.log("ORDER API DATA:", data);

    const insertData = {
      pickup_address: data.pickup_address || "",
      delivery_address: data.delivery_address || "",
      user_email: data.user_email || "",
      price: Number(data.price) || 0,
      status: "Nová objednávka",
    };

    const { data: insertedOrders, error } = await supabase
      .from("orders")
      .insert([insertData])
      .select();

    if (error) {
      console.error("SUPABASE ERROR:", error);

      return Response.json(
        {
          success: false,
          error: error.message,
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    const newOrder = insertedOrders?.[0] || insertData;

    try {
      await sendOrderNotification(newOrder);
      console.log("EMAIL NOTIFICATION SENT");
    } catch (emailError) {
      console.error("EMAIL ERROR:", emailError);
    }

    return Response.json(
      {
        success: true,
        order: newOrder,
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("ORDER API ERROR:", error);

    return Response.json(
      {
        success: false,
        error: error.message || "Nepodarilo sa vytvoriť objednávku.",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}