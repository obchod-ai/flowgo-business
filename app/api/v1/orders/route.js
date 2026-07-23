import { supabase } from "../../../../lib/supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-FlowGo-Api-Key",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  try {
    const expectedApiKey = process.env.FLOWGO_WOOCOMMERCE_API_KEY;
    const receivedApiKey = req.headers.get("x-flowgo-api-key");

    if (!expectedApiKey) {
      return Response.json(
        {
          success: false,
          error: "Na serveru chybí FLOWGO_WOOCOMMERCE_API_KEY.",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    if (!receivedApiKey || receivedApiKey !== expectedApiKey) {
      return Response.json(
        {
          success: false,
          error: "Neplatný FlowGo API klíč.",
        },
        {
          status: 401,
          headers: corsHeaders,
        }
      );
    }

    const data = await req.json();

    const pickupAddress = data.pickup_address?.trim();
    const deliveryAddress = data.delivery_address?.trim();
    const customerEmail = data.customer_email?.trim();
    const price = Number(data.price);

    if (!pickupAddress || !deliveryAddress) {
      return Response.json(
        {
          success: false,
          error: "Chybí adresa vyzvednutí nebo doručení.",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    if (!customerEmail) {
      return Response.json(
        {
          success: false,
          error: "Chybí e-mail zákazníka.",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    if (!Number.isFinite(price) || price <= 0) {
      return Response.json(
        {
          success: false,
          error: "Cena dopravy není platná.",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    const insertData = {
      pickup_address: pickupAddress,
      delivery_address: deliveryAddress,
      user_email: customerEmail,
      price,
      status: "Nová objednávka",
    };

    const { data: createdOrder, error } = await supabase
      .from("orders")
      .insert([insertData])
      .select("id")
      .single();

    if (error) {
      console.error("FLOWGO ORDER INSERT ERROR:", error);

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

    console.log("FLOWGO WOOCOMMERCE ORDER CREATED:", {
      flowgo_order_id: createdOrder?.id,
      external_order_id: data.external_order_id || null,
      customer_name: data.customer_name || null,
      customer_phone: data.customer_phone || null,
    });

    return Response.json(
      {
        success: true,
        flowgo_order_id: createdOrder?.id || null,
        message: "Objednávka byla úspěšně vytvořena ve FlowGo.",
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("FLOWGO ORDERS API ERROR:", error);

    return Response.json(
      {
        success: false,
        error: error.message || "Objednávku se nepodařilo vytvořit.",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}