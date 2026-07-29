import { supabase } from "../../../../lib/supabase";
import { createFlowGoQuote } from "../../../../lib/flowgoQuote";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-FlowGo-Api-Key",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function cleanText(value, maxLength = 1000) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanOrderItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.slice(0, 100).map((item) => ({
    product_id: cleanText(item?.product_id, 100),
    name: cleanText(item?.name, 300),
    quantity: Math.max(0, Number(item?.quantity) || 0),
    total: Math.max(0, Number(item?.total) || 0),
  }));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isPartnerOrder(data) {
  return Boolean(data.external_order_id || data.source);
}

function hasValidPartnerApiKey(request) {
  const expectedKey = process.env.FLOWGO_PARTNER_API_KEY;
  const receivedKey = request.headers.get("x-flowgo-api-key");

  return Boolean(
    expectedKey &&
      receivedKey &&
      receivedKey === expectedKey
  );
}

async function sendOrderNotification(order) {
  const resendApiKey = process.env.RESEND_API_KEY;

  const notificationEmail =
    process.env.ORDER_NOTIFICATION_EMAIL ||
    "obchod@flowgo.cz";

  const fromEmail =
    process.env.RESEND_FROM_EMAIL ||
    "obchod@flowgo.cz";

  if (!resendApiKey) {
    throw new Error("Chýba RESEND_API_KEY.");
  }

  const orderItems = Array.isArray(order.order_items)
    ? order.order_items
    : [];

  const itemsHtml = orderItems
    .map(
      (item) => `
        <li>
          ${escapeHtml(item.name)}
          × ${escapeHtml(item.quantity)}
          – ${Number(item.total || 0).toLocaleString(
            "cs-CZ"
          )} Kč
        </li>
      `
    )
    .join("");

  const response = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `FlowGo objednávky <${fromEmail}>`,
        to: [notificationEmail],
        subject: order.external_order_id
          ? `Nová objednávka FlowGo #${escapeHtml(
              order.external_order_id
            )}`
          : "Nová objednávka na business.flowgo.cz",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 680px;">
            <h2 style="color: #16a765;">
              Nová objednávka FlowGo
            </h2>

            <p>
              <strong>Zdroj:</strong><br>
              ${escapeHtml(
                order.source || "business.flowgo.cz"
              )}
            </p>

            ${
              order.external_order_id
                ? `
                  <p>
                    <strong>Číslo objednávky:</strong><br>
                    ${escapeHtml(order.external_order_id)}
                  </p>
                `
                : ""
            }

            <p>
              <strong>Vyzdvihnutie:</strong><br>
              ${escapeHtml(
                order.pickup_address || "Neuvedené"
              )}
            </p>

            <p>
              <strong>Kontakt na vyzdvihnutie:</strong><br>
              ${escapeHtml(
                order.pickup_contact_name || "Neuvedené"
              )}
              ${
                order.pickup_contact_phone
                  ? `– ${escapeHtml(
                      order.pickup_contact_phone
                    )}`
                  : ""
              }
            </p>

            <p>
              <strong>Doručenie:</strong><br>
              ${escapeHtml(
                order.delivery_address || "Neuvedené"
              )}
            </p>

            <p>
              <strong>Príjemca:</strong><br>
              ${escapeHtml(
                order.delivery_contact_name ||
                  order.customer_name ||
                  "Neuvedené"
              )}
              ${
                order.delivery_contact_phone ||
                order.customer_phone
                  ? `– ${escapeHtml(
                      order.delivery_contact_phone ||
                        order.customer_phone
                    )}`
                  : ""
              }
            </p>

            <p>
              <strong>Firma:</strong><br>
              ${escapeHtml(
                order.company_name || "Neuvedené"
              )}
            </p>

            <p>
              <strong>E-mail:</strong><br>
              ${escapeHtml(
                order.user_email || "Neuvedené"
              )}
            </p>

            <p>
              <strong>Cena dopravy:</strong><br>
              ${Number(order.price || 0).toLocaleString(
                "cs-CZ"
              )} Kč
            </p>

            ${
              order.distance_km
                ? `
                  <p>
                    <strong>Vzdialenosť:</strong><br>
                    ${escapeHtml(order.distance_km)} km
                  </p>
                `
                : ""
            }

            ${
              order.duration
                ? `
                  <p>
                    <strong>Odhadovaný čas:</strong><br>
                    ${escapeHtml(order.duration)}
                  </p>
                `
                : ""
            }

            ${
              order.note
                ? `
                  <p>
                    <strong>Poznámka:</strong><br>
                    ${escapeHtml(order.note)}
                  </p>
                `
                : ""
            }

            ${
              itemsHtml
                ? `
                  <p><strong>Položky:</strong></p>
                  <ul>${itemsHtml}</ul>
                `
                : ""
            }

            <p>
              <strong>Stav:</strong><br>
              ${escapeHtml(
                order.status || "Nová objednávka"
              )}
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
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Resend chyba: ${response.status} – ${errorText}`
    );
  }

  return response.json();
}

export async function POST(req) {
  try {
    const data = await req.json();

    console.log("ORDER API DATA:", data);

    const partnerOrder = isPartnerOrder(data);

    if (
      partnerOrder &&
      !hasValidPartnerApiKey(req)
    ) {
      return Response.json(
        {
          success: false,
          error: "Neplatný FlowGo API kľúč.",
        },
        {
          status: 401,
          headers: corsHeaders,
        }
      );
    }

    const pickupAddress = cleanText(
      data.pickup_address,
      1000
    );

    const deliveryAddress = cleanText(
      data.delivery_address,
      1000
    );

    if (!pickupAddress || !deliveryAddress) {
      return Response.json(
        {
          success: false,
          error:
            "Chýba adresa vyzdvihnutia alebo doručenia.",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    const source = cleanText(
      data.source ||
        (partnerOrder
          ? "Servis Pánská / WooCommerce"
          : "business.flowgo.cz"),
      200
    );

    const externalOrderId = cleanText(
      data.external_order_id,
      150
    );

    if (partnerOrder && !externalOrderId) {
      return Response.json(
        {
          success: false,
          error:
            "Pri partnerskej objednávke chýba external_order_id.",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    if (partnerOrder) {
      const { data: existingOrder, error: existingError } =
        await supabase
          .from("orders")
          .select("*")
          .eq("source", source)
          .eq("external_order_id", externalOrderId)
          .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingOrder) {
        return Response.json(
          {
            success: true,
            duplicate: true,
            order: existingOrder,
          },
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      }
    }

    let finalPickupAddress = pickupAddress;
    let finalDeliveryAddress = deliveryAddress;
    let finalPrice = Number(data.price) || 0;
    let region = null;
    let distanceKm = null;
    let duration = null;
    let currency = "CZK";

    if (partnerOrder) {
      const quote = await createFlowGoQuote(
        pickupAddress,
        deliveryAddress
      );

      if (!quote.available) {
        return Response.json(
          {
            success: false,
            error:
              quote.message ||
              "Doprava FlowGo nie je dostupná.",
          },
          {
            status: 400,
            headers: corsHeaders,
          }
        );
      }

      finalPickupAddress = quote.pickup_address;
      finalDeliveryAddress =
        quote.delivery_address;
      finalPrice = Number(quote.price) || 0;
      region = quote.region || null;
      distanceKm =
        Number(quote.distance_km) || null;
      duration = quote.duration || null;
      currency = quote.currency || "CZK";
    }

    const insertData = {
      pickup_address: finalPickupAddress,
      delivery_address: finalDeliveryAddress,

      pickup_contact_name: cleanText(
        data.pickup_contact_name,
        250
      ),

      pickup_contact_phone: cleanText(
        data.pickup_contact_phone,
        100
      ),

      pickup_contact_email: cleanText(
        data.pickup_contact_email,
        320
      ),

      delivery_contact_name: cleanText(
        data.delivery_contact_name ||
          data.customer_name,
        250
      ),

      delivery_contact_phone: cleanText(
        data.delivery_contact_phone ||
          data.customer_phone,
        100
      ),

      delivery_contact_email: cleanText(
        data.delivery_contact_email ||
          data.customer_email ||
          data.user_email,
        320
      ),

      customer_name: cleanText(
        data.customer_name,
        250
      ),

      customer_phone: cleanText(
        data.customer_phone,
        100
      ),

      customer_email: cleanText(
        data.customer_email ||
          data.user_email,
        320
      ),

      user_email: cleanText(
        data.user_email ||
          data.customer_email,
        320
      ),

      company_name: cleanText(
        data.company_name,
        300
      ),

      company_ico: cleanText(
        data.company_ico,
        100
      ),

      price: finalPrice,
      status: "Nová objednávka",

      external_order_id:
        externalOrderId || null,

      source,
      note: cleanText(data.note, 3000),
      currency,
      region,
      distance_km: distanceKm,
      duration,

      order_total:
        Math.max(
          0,
          Number(data.order_total) || 0
        ),

      payment_method: cleanText(
        data.payment_method,
        200
      ),

      order_items: cleanOrderItems(
        data.order_items
      ),
    };

    const { data: insertedOrders, error } =
      await supabase
        .from("orders")
        .insert([insertData])
        .select();

    if (error) {
      console.error("SUPABASE ERROR:", error);

      if (
        partnerOrder &&
        error.code === "23505"
      ) {
        const { data: duplicateOrder } =
          await supabase
            .from("orders")
            .select("*")
            .eq("source", source)
            .eq(
              "external_order_id",
              externalOrderId
            )
            .maybeSingle();

        return Response.json(
          {
            success: true,
            duplicate: true,
            order: duplicateOrder,
          },
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      }

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

    const newOrder =
      insertedOrders?.[0] || insertData;

    try {
      await sendOrderNotification(newOrder);

      console.log(
        "EMAIL NOTIFICATION SENT"
      );
    } catch (emailError) {
      console.error(
        "EMAIL ERROR:",
        emailError
      );
    }

    return Response.json(
      {
        success: true,
        duplicate: false,
        order: newOrder,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("ORDER API ERROR:", error);

    return Response.json(
      {
        success: false,
        error:
          error.message ||
          "Nepodarilo sa vytvoriť objednávku.",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}